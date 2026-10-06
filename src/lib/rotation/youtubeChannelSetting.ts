import * as pageSettings from "@/lib/repos/pageSettings";
import { BIRTHDAY_PAGE_KEYS } from "@/lib/birthdays/visibility";
import {
  DEFAULT_SLIDE_SECONDS,
  DEFAULT_YOUTUBE_DAYS,
  type YouTubeChannelMode,
} from "@/lib/entities";

const SETTINGS_KEY = "rotation/youtube-channel";
const SETTINGS_LABEL = "YouTube channel in rotations";

/**
 * The site-wide YouTube channel slide: one channel whose videos come up
 * between pages on every rotating dashboard, every `everyPages` pages. On
 * dashboards that don't flip pages, a "page" is one minute.
 */
export interface YouTubeChannelSetting {
  enabled: boolean;
  channelId: string;
  channelName: string;
  mode: YouTubeChannelMode;
  days: number;
  slideSeconds: number;
  everyPages: number;
  pageKeys: string[];
  /** Turn YouTube's subtitles on for the videos. */
  subtitles: boolean;
  /** Next/Prev also step onto the slide, not only the timer. */
  includeInNext: boolean;
}

export const YOUTUBE_CHANNEL_DEFAULTS: YouTubeChannelSetting = {
  enabled: true,
  channelId: "UCvKdriKghQ_4ECQKcFxDrOQ",
  channelName: "Asian Business Channel",
  mode: "cycle",
  days: DEFAULT_YOUTUBE_DAYS,
  slideSeconds: DEFAULT_SLIDE_SECONDS,
  everyPages: 3,
  pageKeys: BIRTHDAY_PAGE_KEYS.map((p) => p.key),
  subtitles: false,
  includeInNext: false,
};

export const MAX_SLIDE_SECONDS = 15 * 60;
const MODES: YouTubeChannelMode[] = ["cycle", "newest", "live"];
const ALLOWED_KEYS = new Set(BIRTHDAY_PAGE_KEYS.map((p) => p.key));

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** Fills gaps and drops bad values, so a partial or stale save still works. */
export function normalizeSetting(raw: Partial<YouTubeChannelSetting> | undefined): YouTubeChannelSetting {
  const d = YOUTUBE_CHANNEL_DEFAULTS;
  const r = raw ?? {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    channelId:
      typeof r.channelId === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(r.channelId)
        ? r.channelId
        : d.channelId,
    channelName: typeof r.channelName === "string" ? r.channelName : d.channelName,
    mode: MODES.includes(r.mode as YouTubeChannelMode) ? (r.mode as YouTubeChannelMode) : d.mode,
    days: clampInt(r.days, 1, 365, d.days),
    slideSeconds: clampInt(r.slideSeconds, 10, MAX_SLIDE_SECONDS, d.slideSeconds),
    everyPages: clampInt(r.everyPages, 1, 100, d.everyPages),
    subtitles: typeof r.subtitles === "boolean" ? r.subtitles : d.subtitles,
    includeInNext: typeof r.includeInNext === "boolean" ? r.includeInNext : d.includeInNext,
    pageKeys: Array.isArray(r.pageKeys)
      ? r.pageKeys.filter((k): k is string => typeof k === "string" && ALLOWED_KEYS.has(k))
      : d.pageKeys,
  };
}

export async function getYouTubeChannelSetting(): Promise<YouTubeChannelSetting> {
  const saved = await pageSettings.findByKey(SETTINGS_KEY);
  return normalizeSetting(saved?.settings as Partial<YouTubeChannelSetting> | undefined);
}

export async function saveYouTubeChannelSetting(s: YouTubeChannelSetting): Promise<void> {
  await pageSettings.upsert({
    pageKey: SETTINGS_KEY,
    label: SETTINGS_LABEL,
    settings: { ...normalizeSetting(s) },
  });
}
