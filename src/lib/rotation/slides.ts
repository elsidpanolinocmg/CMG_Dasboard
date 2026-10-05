import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";
import * as customPagesRepo from "@/lib/repos/customPages";
import {
  DEFAULT_SLIDE_SECONDS,
  DEFAULT_YOUTUBE_DAYS,
  type CustomPage,
} from "@/lib/entities";
import type { BirthdaySlideEntry } from "@/components/BirthdaySlide";
import { parseYouTubeId, youTubeEmbedBase } from "@/lib/youtube";
import { pickChannelVideos, type PickedVideo } from "@/lib/youtubeChannel";
import { getYouTubeChannelSetting } from "./youtubeChannelSetting";

/** The videos a YouTube page plays right now; empty for other kinds. */
export async function youTubeVideosFor(p: CustomPage): Promise<PickedVideo[]> {
  if (p.mediaKind === "youtube") {
    const id = parseYouTubeId(p.mediaPath);
    return id ? [{ id, title: "" }] : [];
  }
  if (p.mediaKind === "youtube-channel") {
    return pickChannelVideos(
      p.mediaPath,
      p.youtubeMode ?? "cycle",
      p.youtubeDays ?? DEFAULT_YOUTUBE_DAYS,
    );
  }
  return [];
}

/** Null when a YouTube page has nothing playable right now. */
export async function customPageToSlide(p: CustomPage): Promise<BirthdaySlideEntry | null> {
  if (p.mediaKind === "youtube" || p.mediaKind === "youtube-channel") {
    const ids = (await youTubeVideosFor(p)).map((v) => v.id);
    if (ids.length === 0) return null;
    return {
      id: `custom-${p.id}`,
      kind: "custom",
      displayName: p.title,
      mediaKind: "youtube",
      mediaPath: youTubeEmbedBase(ids[0]),
      youtubeIds: ids,
      holdMs: (p.slideSeconds ?? DEFAULT_SLIDE_SECONDS) * 1000,
      subtitles: !!p.subtitles,
      hideGreeting: true,
      inNext: !!p.includeInNext,
      showTitle: !!p.showTitle,
    };
  }
  return {
    id: `custom-${p.id}`,
    kind: "custom",
    displayName: p.title,
    mediaKind: p.mediaKind,
    mediaPath: p.mediaPath,
    hideGreeting: true,
    finishVideo: p.mediaKind === "video" && !!p.finishVideo,
    inNext: !!p.includeInNext,
    showTitle: !!p.showTitle,
  };
}

/**
 * The site-wide YouTube channel slide for `pageKey`, or null when it is off,
 * not on this page, or the channel has nothing playable right now.
 */
async function channelSlide(pageKey: string): Promise<BirthdaySlideEntry | null> {
  const s = await getYouTubeChannelSetting();
  if (!s.enabled || !s.pageKeys.includes(pageKey)) return null;
  const videos = await pickChannelVideos(s.channelId, s.mode, s.days);
  if (videos.length === 0) return null;
  const ids = videos.map((v) => v.id);
  return {
    id: "youtube-channel",
    kind: "custom",
    displayName: s.channelName,
    mediaKind: "youtube",
    mediaPath: youTubeEmbedBase(ids[0]),
    youtubeIds: ids,
    holdMs: s.slideSeconds * 1000,
    everyPages: s.everyPages,
    hideGreeting: true,
    inNext: s.includeInNext,
    subtitles: s.subtitles,
  };
}

/**
 * Everything a dashboard slots into its rotation: today's birthdays (gated by
 * the birthday visibility setting), live custom pages assigned to `pageKey`,
 * and the YouTube channel slide. Any source failing leaves the others intact.
 */
export async function getRotationSlides(pageKey: string): Promise<BirthdaySlideEntry[]> {
  const [birthdays, custom, channel] = await Promise.all([
    getTodaysBirthdaySlides(pageKey).catch((err) => {
      console.error("rotation: birthdays failed", err);
      return [] as BirthdaySlideEntry[];
    }),
    customPagesRepo.listForRotation(pageKey).catch((err) => {
      console.error("rotation: custom pages failed", err);
      return [] as CustomPage[];
    }),
    channelSlide(pageKey).catch((err) => {
      console.error("rotation: youtube channel failed", err);
      return null;
    }),
  ]);
  const slides = await Promise.all(
    custom.map((p) =>
      customPageToSlide(p).catch((err) => {
        console.error(`rotation: custom page ${p.id} failed`, err);
        return null;
      }),
    ),
  );
  return [...birthdays, ...[...slides, channel].filter((s): s is BirthdaySlideEntry => s !== null)];
}
