"use client";

import { useEffect, useRef, useState } from "react";
import { parseYouTubeId } from "@/lib/youtube";
import YouTubeSlidePlayer from "./YouTubeSlidePlayer";

export interface BirthdaySlideEntry {
  id: string;
  /** Missing on older payloads, which are always birthdays. */
  kind?: "birthday" | "custom";
  /** Birthday: the person's name. Custom page: the page title. */
  displayName: string;
  mediaKind: "image" | "video" | "youtube";
  mediaPath: string;
  hideGreeting?: boolean;
  finishVideo?: boolean;
  /** Custom pages only: Next/Prev step onto this slide, not only the timer. */
  inNext?: boolean;
  /** Custom pages only: show the title as a caption. */
  showTitle?: boolean;
  /** YouTube only: the videos to play in turn, resuming where the screen left off. */
  youtubeIds?: string[];
  /** YouTube only: force YouTube's subtitles on (otherwise off). */
  subtitles?: boolean;
  /**
   * YouTube channel in "live first" mode: try this channel's live stream in
   * the browser, and play youtubeIds only when it isn't live.
   */
  liveChannel?: string;
  /** Hold the screen this long, then fire onVideoEnded (YouTube slides). */
  holdMs?: number;
  /**
   * Recurring slide (the site-wide YouTube channel): comes up after every this
   * many pages, rather than once per cycle like birthdays. On dashboards that
   * don't flip pages, a page is one minute.
   */
  everyPages?: number;
}

/** Splits a rotation list into once-per-cycle slides and recurring ones. */
export function splitRecurring(entries: BirthdaySlideEntry[]): {
  once: BirthdaySlideEntry[];
  recurring: BirthdaySlideEntry[];
} {
  return {
    once: entries.filter((e) => !e.everyPages),
    recurring: entries.filter((e) => !!e.everyPages),
  };
}

// Safety cap for "finish video" clips, in case the video stalls and never ends.
const MAX_PLAY_ONCE_MS = 20 * 60 * 1000;

/**
 * True when the slide decides its own length and signals the end through
 * onVideoEnded, so the parent should wait for it instead of its own timer.
 */
export function slideHoldsScreen(entry: BirthdaySlideEntry): boolean {
  return (entry.mediaKind === "video" && !!entry.finishVideo) || !!entry.holdMs;
}

interface Props {
  entry: BirthdaySlideEntry;
  className?: string;
  // Fired when a "finish video" clip plays through (or errors), or when a
  // holdMs slide's time is up. The parent uses this to advance the slideshow.
  // Only called for entries where slideHoldsScreen() is true.
  onVideoEnded?: () => void;
}

export default function BirthdaySlide({ entry, className, onVideoEnded }: Props) {
  const playOnce = entry.mediaKind === "video" && !!entry.finishVideo;

  const [notLive, setNotLive] = useState(false);

  const endedRef = useRef(onVideoEnded);
  useEffect(() => {
    endedRef.current = onVideoEnded;
  }, [onVideoEnded]);
  const holdMs = entry.holdMs ?? (playOnce ? MAX_PLAY_ONCE_MS : 0);
  useEffect(() => {
    if (!holdMs) return;
    const t = setTimeout(() => endedRef.current?.(), holdMs);
    return () => clearTimeout(t);
  }, [holdMs]);

  return (
    <div
      className={`relative w-full h-full min-h-screen flex items-center justify-center bg-black overflow-hidden ${className ?? ""}`}
    >
      {entry.mediaKind === "youtube" && entry.liveChannel && !notLive ? (
        <YouTubeSlidePlayer
          slideId={`${entry.id}-live`}
          ids={[]}
          liveChannel={entry.liveChannel}
          subtitles={!!entry.subtitles}
          onPlayingChange={(playing) => {
            if (!playing) setNotLive(true);
          }}
        />
      ) : entry.mediaKind === "youtube" ? (
        <YouTubeSlidePlayer
          slideId={entry.id}
          ids={entry.youtubeIds ?? [parseYouTubeId(entry.mediaPath) ?? ""]}
          subtitles={!!entry.subtitles}
        />
      ) : entry.mediaKind === "image" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.mediaPath}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.mediaPath}
            alt={entry.displayName}
            className="relative w-full h-full object-contain"
          />
        </>
      ) : (
        <>
          <video
            src={entry.mediaPath}
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
            autoPlay
            muted
            loop
            playsInline
          />
          <video
            src={entry.mediaPath}
            className="relative w-full h-full object-contain"
            autoPlay
            muted
            loop={!playOnce}
            playsInline
            onEnded={playOnce ? onVideoEnded : undefined}
            onError={playOnce ? onVideoEnded : undefined}
          />
        </>
      )}
      {entry.kind === "custom" ? (
        entry.showTitle && (
          <div className="absolute inset-x-0 bottom-0 p-8 md:p-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-center">
            <div className="text-2xl md:text-4xl font-semibold tracking-wide drop-shadow">
              {entry.displayName}
            </div>
          </div>
        )
      ) : !entry.hideGreeting && (
        <div className="absolute inset-x-0 bottom-0 p-8 md:p-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-center">
          <div className="text-2xl md:text-4xl font-semibold tracking-wide drop-shadow">
            🎉 Happy Birthday, {entry.displayName}! 🎂
          </div>
        </div>
      )}
    </div>
  );
}
