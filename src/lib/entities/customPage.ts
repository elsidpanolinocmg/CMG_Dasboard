import type { Timestamped } from "./common";

/**
 * "youtube": mediaPath is a YouTube embed URL instead of an uploaded file.
 * "youtube-channel": mediaPath is a channel id (UC…); the videos are picked
 * from the channel's feed each time, per `youtubeMode`.
 */
export type CustomPageMediaKind = "image" | "video" | "youtube" | "youtube-channel";

export type YouTubeChannelMode = "cycle" | "newest" | "live";

export const DEFAULT_YOUTUBE_DAYS = 7;
export const DEFAULT_SLIDE_SECONDS = 5 * 60;

/**
 * An admin-made full-screen page holding one image or video. It has its own
 * URL (/custom/<id>), can be linked from the home page, and can be dropped
 * into the rotation of other dashboards the same way a birthday slide is.
 *
 * `startsAt`/`endsAt` follow QuickLink: ISO-8601 UTC strings, null when
 * cleared. The schedule governs both the home-page link and the rotation; the
 * page's own URL stays reachable while `active` so it can be previewed.
 */
export interface CustomPage extends Timestamped {
  id: string;
  title: string;
  mediaKind: CustomPageMediaKind;
  mediaPath: string;
  active: boolean;
  order: number;
  startsAt?: string | null;
  endsAt?: string | null;
  /** List the page under Quick links on the home page. */
  showOnHome: boolean;
  /** Page keys (see BIRTHDAY_PAGE_KEYS) whose rotation includes this page. Empty = none. */
  rotationPageKeys: string[];
  /** When in a rotation, Next/Prev also step onto it — not only the timer. */
  includeInNext: boolean;
  /** Show the title as a caption over the media. */
  showTitle?: boolean;
  /** Video only: stay until the clip ends instead of looping. */
  finishVideo?: boolean;
  /** YouTube channel only: which videos to play. Missing = "cycle". */
  youtubeMode?: YouTubeChannelMode;
  /** YouTube channel "cycle" only: how far back to look, in days. */
  youtubeDays?: number;
  /** YouTube channel only: the channel name, for the admin list. */
  youtubeChannelName?: string;
  /** YouTube (video or channel): seconds the slide holds a rotation. */
  slideSeconds?: number;
  /** YouTube (video or channel): turn YouTube's subtitles on. */
  subtitles?: boolean;
}

/** True when the page is switched on and inside its scheduled window at `now`. */
export function isCustomPageLive(page: CustomPage, now: Date = new Date()): boolean {
  if (page.active === false) return false;
  const t = now.getTime();
  if (page.startsAt) {
    const start = Date.parse(page.startsAt);
    if (Number.isNaN(start) || t < start) return false;
  }
  if (page.endsAt) {
    const end = Date.parse(page.endsAt);
    if (Number.isNaN(end) || t >= end) return false;
  }
  return true;
}
