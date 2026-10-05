import "server-only";
import type { YouTubeChannelMode } from "@/lib/entities";

// YouTube serves a cut-down page (no channel ids) to unknown clients.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const CHANNEL_ID = /UC[A-Za-z0-9_-]{22}/;

const FEED_REVALIDATE_S = 15 * 60;
const EMBED_REVALIDATE_S = 60 * 60;
const LIVE_REVALIDATE_S = 2 * 60;

export interface ChannelVideo {
  id: string;
  published: string;
}

async function fetchText(url: string, revalidate: number | false): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/**
 * Turns whatever an admin pastes (a channel link, an @handle, a /c/ or /user/
 * link, or a video from the channel) into the channel id and its name. Only
 * youtube.com pages are fetched. Null when no channel is found.
 */
export async function resolveChannel(
  input: string,
): Promise<{ channelId: string; name: string } | null> {
  const text = input.trim();
  const directId =
    text.match(/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1] ??
    (/^UC[A-Za-z0-9_-]{22}$/.test(text) ? text : null);

  let url: URL;
  try {
    url = new URL(
      directId
        ? `https://www.youtube.com/channel/${directId}`
        : text.startsWith("@")
          ? `https://www.youtube.com/${text}`
          : text,
    );
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(url.hostname)) return null;
  const html = await fetchText(url.toString(), false);
  if (!html) return null;

  // A channel page carries its own id as externalId; a video page names its
  // channel as channelId.
  const channelId =
    directId ??
    html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] ??
    html.match(/rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/)?.[1] ??
    html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] ??
    null;
  if (!channelId || !CHANNEL_ID.test(channelId)) return null;

  const isChannelPage = html.includes(`"externalId":"${channelId}"`);
  const name = isChannelPage
    ? decodeHtml(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? "")
    : decodeHtml(html.match(/"ownerChannelName":"([^"]*)"/)?.[1] ?? "");
  return { channelId, name };
}

function feedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Last good list per channel, for when YouTube has a bad few minutes.
const lastGood = new Map<string, ChannelVideo[]>();

/**
 * The channel's latest uploads, newest first. YouTube's feed fails at random
 * (404/500 for the same URL), so it is retried, then the Videos tab is read
 * instead, then the last good list is reused.
 */
export async function listChannelVideos(channelId: string): Promise<ChannelVideo[]> {
  let videos: ChannelVideo[] | null = null;
  for (let attempt = 0; attempt < 3 && !videos; attempt++) {
    const xml = await fetchText(feedUrl(channelId), attempt === 0 ? FEED_REVALIDATE_S : false);
    if (xml) videos = parseFeed(xml);
  }
  if (!videos?.length) videos = await scrapeVideosTab(channelId);
  if (videos.length) {
    lastGood.set(channelId, videos);
    return videos;
  }
  return lastGood.get(channelId) ?? [];
}

function parseFeed(xml: string): ChannelVideo[] {
  const out: ChannelVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (id && published) out.push({ id, published });
  }
  return out.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

const AGE_UNITS: [RegExp, number][] = [
  [/^(s|secs?|seconds?)$/, 1],
  [/^(m|mins?|minutes?)$/, 60],
  [/^(h|hrs?|hours?)$/, 3600],
  [/^(d|days?)$/, 86400],
  [/^(w|wks?|weeks?)$/, 7 * 86400],
  [/^(mo|months?)$/, 30 * 86400],
  [/^(y|yrs?|years?)$/, 365 * 86400],
];

/** "3d ago", "15 min ago", "2 weeks ago" → an approximate ISO date. */
function ageToIso(text: string, now: number): string | null {
  const m = text.replace(/ /g, " ").match(/(\d+)\s*([a-z]+)\s+ago/i);
  if (!m) return null;
  const unit = AGE_UNITS.find(([re]) => re.test(m[2].toLowerCase()));
  return unit ? new Date(now - Number(m[1]) * unit[1] * 1000).toISOString() : null;
}

/** Fallback: the channel's Videos tab, already newest first. Dates are approximate. */
async function scrapeVideosTab(channelId: string): Promise<ChannelVideo[]> {
  const html = await fetchText(`https://www.youtube.com/channel/${channelId}/videos`, false);
  if (!html) return [];
  const now = Date.now();
  const out: ChannelVideo[] = [];
  for (const seg of html.split('"lockupViewModel"').slice(1)) {
    const id = seg.match(/"contentId":"([A-Za-z0-9_-]{11})"/)?.[1];
    const age = seg.match(/"content":"([^"]{1,40}ago)"/)?.[1];
    const published = age ? ageToIso(age, now) : null;
    if (id && published && !out.some((v) => v.id === id)) out.push({ id, published });
  }
  return out;
}

export interface PickedVideo {
  id: string;
  /** Empty when YouTube didn't say. */
  title: string;
}

/**
 * Null when the owner has switched off "Allow embedding" — YouTube's oEmbed
 * answers 401 for those — otherwise the video with its title. Network trouble
 * counts as playable so a hiccup doesn't empty the rotation.
 */
async function embeddableVideo(id: string): Promise<PickedVideo | null> {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${id}`,
    )}`;
    const res = await fetch(url, { next: { revalidate: EMBED_REVALIDATE_S } });
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    const body = res.ok ? ((await res.json().catch(() => null)) as { title?: unknown } | null) : null;
    return { id, title: typeof body?.title === "string" ? body.title : "" };
  } catch {
    return { id, title: "" };
  }
}

/** The video id the channel is streaming right now, or null. */
async function liveVideoId(channelId: string): Promise<string | null> {
  const html = await fetchText(
    `https://www.youtube.com/channel/${channelId}/live`,
    LIVE_REVALIDATE_S,
  );
  // YouTube marks a running stream with either flag, depending on the page
  // version served; a scheduled one carries isUpcoming instead.
  if (!html || html.includes('"isUpcoming":true')) return null;
  if (!html.includes('"isLiveNow":true') && !html.includes('"isLive":true')) return null;
  return html.match(/rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/)?.[1] ?? null;
}

/**
 * The videos a channel page should play, skipping any that can't be embedded:
 * - newest: just the latest upload
 * - cycle:  every upload from the last `days` days (may be empty)
 * - live:   the live stream when there is one, otherwise the latest upload
 */
export async function pickChannelVideos(
  channelId: string,
  mode: YouTubeChannelMode,
  days: number,
  now: Date = new Date(),
): Promise<PickedVideo[]> {
  if (mode === "live") {
    const live = await liveVideoId(channelId);
    const video = live ? await embeddableVideo(live) : null;
    if (video) return [video];
  }
  let videos = await listChannelVideos(channelId);
  if (mode === "cycle") {
    const since = now.getTime() - days * 24 * 3600 * 1000;
    videos = videos.filter((v) => Date.parse(v.published) >= since);
  }
  const checked = await Promise.all(videos.map((v) => embeddableVideo(v.id)));
  const playable = checked.filter((v): v is PickedVideo => v !== null);
  return mode === "cycle" ? playable : playable.slice(0, 1);
}
