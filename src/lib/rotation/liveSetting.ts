import * as pageSettings from "@/lib/repos/pageSettings";
import { getYouTubeChannelSetting } from "./youtubeChannelSetting";

const SETTINGS_KEY = "editorial/live";
const SETTINGS_LABEL = "Editorial Live page";

export type LiveSource = "same" | "channel" | "video";
export type LiveWhenOffline = "message" | "videos";

/**
 * The Editorial Live page (/dashboard/editorial/live). By default it follows
 * the channel in Admin → YouTube channel; it can instead use its own channel
 * or one specific video (e.g. a scheduled event stream).
 */
export interface LiveSetting {
  source: LiveSource;
  /** source "channel" only. */
  channelId: string;
  channelName: string;
  /** source "video" only. */
  videoId: string;
  subtitles: boolean;
  /** Channel sources only: what to show while the channel isn't live. */
  whenOffline: LiveWhenOffline;
  /** Replaces the default "starts by itself" line on the waiting screen. */
  offlineMessage: string;
  /** List the page on the home page and in the Editorial controls. */
  showLink: boolean;
}

export const LIVE_DEFAULTS: LiveSetting = {
  source: "same",
  channelId: "",
  channelName: "",
  videoId: "",
  subtitles: false,
  whenOffline: "message",
  offlineMessage: "",
  showLink: true,
};

const MAX_MESSAGE = 300;

export function normalizeLiveSetting(raw: Partial<LiveSetting> | undefined): LiveSetting {
  const d = LIVE_DEFAULTS;
  const r = raw ?? {};
  const channelId =
    typeof r.channelId === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(r.channelId) ? r.channelId : "";
  const videoId =
    typeof r.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(r.videoId) ? r.videoId : "";
  let source: LiveSource = r.source === "channel" || r.source === "video" ? r.source : "same";
  // A source without its id can't play; fall back to the shared channel.
  if ((source === "channel" && !channelId) || (source === "video" && !videoId)) source = "same";
  return {
    source,
    channelId,
    channelName: typeof r.channelName === "string" ? r.channelName : "",
    videoId,
    subtitles: typeof r.subtitles === "boolean" ? r.subtitles : d.subtitles,
    whenOffline: r.whenOffline === "videos" ? "videos" : "message",
    offlineMessage:
      typeof r.offlineMessage === "string" ? r.offlineMessage.trim().slice(0, MAX_MESSAGE) : "",
    showLink: typeof r.showLink === "boolean" ? r.showLink : d.showLink,
  };
}

export async function getLiveSetting(): Promise<LiveSetting> {
  const saved = await pageSettings.findByKey(SETTINGS_KEY);
  return normalizeLiveSetting(saved?.settings as Partial<LiveSetting> | undefined);
}

export async function saveLiveSetting(s: LiveSetting): Promise<void> {
  await pageSettings.upsert({
    pageKey: SETTINGS_KEY,
    label: SETTINGS_LABEL,
    settings: { ...normalizeLiveSetting(s) },
  });
}

/** What the Live page plays, with "same" resolved to the shared channel. */
export type ResolvedLive =
  | { kind: "channel"; channelId: string; channelName: string }
  | { kind: "video"; videoId: string };

export async function resolveLiveSource(s: LiveSetting): Promise<ResolvedLive> {
  if (s.source === "video") return { kind: "video", videoId: s.videoId };
  if (s.source === "channel") {
    return { kind: "channel", channelId: s.channelId, channelName: s.channelName };
  }
  const shared = await getYouTubeChannelSetting();
  return { kind: "channel", channelId: shared.channelId, channelName: shared.channelName };
}
