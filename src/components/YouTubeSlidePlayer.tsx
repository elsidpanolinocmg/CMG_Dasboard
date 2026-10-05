"use client";

import { useEffect, useRef } from "react";

// Just the slice of YouTube's IFrame Player API used here.
interface YTPlayer {
  getCurrentTime(): number;
  loadVideoById(args: { videoId: string; startSeconds?: number }): void;
  mute(): void;
  unMute(): void;
  playVideo(): void;
  loadModule(name: string): void;
  unloadModule(name: string): void;
  setOption(module: string, option: string, value: unknown): void;
  getOption(module: string, option: string): unknown;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { target: YTPlayer; data: number }) => void;
        onError?: (e: { target: YTPlayer }) => void;
        onApiChange?: (e: { target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        if (window.YT) resolve(window.YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

function applySubtitles(player: YTPlayer, on: boolean) {
  try {
    // Loading the module makes YouTube list the tracks (onApiChange), where
    // pickEnglishTrack switches one on.
    if (on) player.loadModule("captions");
    else player.unloadModule("captions");
  } catch {
    /* player not ready */
  }
}

/**
 * Turns on an English track, auto-generated ones included (the cc_load_policy
 * URL setting alone often skips those), else whatever track there is.
 */
function pickEnglishTrack(player: YTPlayer) {
  try {
    const tracks = player.getOption("captions", "tracklist") as
      | { languageCode?: string }[]
      | undefined;
    if (!tracks?.length) return;
    const track = tracks.find((t) => t.languageCode?.startsWith("en")) ?? tracks[0];
    player.setOption("captions", "track", track);
  } catch {
    /* no captions on this video */
  }
}

interface Progress {
  id: string;
  t: number;
}

const SAVE_EVERY_MS = 5000;

function readProgress(key: string): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(key) ?? "null") as Progress | null;
    return p && typeof p.id === "string" && typeof p.t === "number" ? p : null;
  } catch {
    return null;
  }
}

function writeProgress(key: string, p: Progress) {
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {
    /* storage blocked — the slide just starts from the top next time */
  }
}

/**
 * Plays `ids` muted, one after another, and remembers on this screen how far
 * it got. The next time the slide comes up it carries on from that spot, and
 * when a video ends it moves to the next one. A video that drops out of the
 * list (too old) is replaced by the newest.
 *
 * With `liveChannel` it instead plays whatever that channel is streaming now,
 * and with `uploadsOf` the channel's uploads, newest first, on a loop.
 * YouTube resolves the stream in the viewer's browser, which is reliable where
 * a server lookup isn't (YouTube serves data centres a different page).
 */
export default function YouTubeSlidePlayer({
  slideId,
  ids,
  subtitles,
  muted = true,
  resume = true,
  liveChannel,
  uploadsOf,
  onPlayingChange,
}: {
  slideId: string;
  ids: string[];
  /** Force YouTube's subtitles on; otherwise they are switched off. */
  subtitles: boolean;
  /**
   * Sound off (the default). Browsers only autoplay muted, so sound can only
   * come on after the viewer clicks something on the page.
   */
  muted?: boolean;
  /** Carry on where this screen stopped last time. Off for live streams. */
  resume?: boolean;
  /** Play this channel's current live stream; `ids` is then ignored. */
  liveChannel?: string;
  /** Play this channel's uploads (YouTube's own list); `ids` is then ignored. */
  uploadsOf?: string;
  /** Told when playback starts (true) and when it ends or can't play (false). */
  onPlayingChange?: (playing: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const idsKey = ids.join(",");
  const playerRef = useRef<YTPlayer | null>(null);
  const mutedRef = useRef(muted);
  const playingRef = useRef(onPlayingChange);
  useEffect(() => {
    playingRef.current = onPlayingChange;
  }, [onPlayingChange]);

  useEffect(() => {
    mutedRef.current = muted;
    try {
      if (muted) playerRef.current?.mute();
      else playerRef.current?.unMute();
    } catch {
      /* player not ready — onReady applies it */
    }
  }, [muted]);

  useEffect(() => {
    // "live_stream" + the channel player var is YouTube's own "current live
    // stream of this channel" embed.
    // A channel's uploads list is its id with UC swapped for UU.
    const uploads = uploadsOf ? `UU${uploadsOf.slice(2)}` : null;
    const list = liveChannel
      ? ["live_stream"]
      : uploads
        ? [uploads]
        : idsKey.split(",").filter(Boolean);
    if (list.length === 0) return;
    const keep = resume && !liveChannel && !uploads;
    const key = `yt-progress:${slideId}`;
    const saved = keep ? readProgress(key) : null;
    let idx = saved ? list.indexOf(saved.id) : -1;
    const start = idx >= 0 ? saved!.t : 0;
    if (idx < 0) idx = 0;

    let player: YTPlayer | null = null;
    let cancelled = false;
    let failures = 0;
    let saveTimer: ReturnType<typeof setInterval> | undefined;

    const savePosition = () => {
      try {
        const t = player?.getCurrentTime();
        if (keep && typeof t === "number" && t > 0) writeProgress(key, { id: list[idx], t });
      } catch {
        /* player not ready */
      }
    };
    const playNext = (target: YTPlayer) => {
      idx = (idx + 1) % list.length;
      if (keep) writeProgress(key, { id: list[idx], t: 0 });
      target.loadVideoById({ videoId: list[idx], startSeconds: 0 });
    };

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const el = document.createElement("div");
      hostRef.current.appendChild(el);
      player = new YT.Player(el, {
        ...(uploads ? {} : { videoId: list[idx] }),
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
          start: Math.floor(start),
          cc_load_policy: subtitles ? 1 : 0,
          cc_lang_pref: "en",
          ...(liveChannel ? { channel: liveChannel } : {}),
          ...(uploads ? { listType: "playlist", list: uploads, loop: 1 } : {}),
        },
        events: {
          onReady: (e) => {
            playerRef.current = e.target;
            if (mutedRef.current) e.target.mute();
            else e.target.unMute();
            e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              // A finished stream has nothing to move on to.
              if (liveChannel) playingRef.current?.(false);
              else if (!uploads) playNext(e.target);
            } else failures = 0;
            if (e.data === YT.PlayerState.PLAYING) playingRef.current?.(true);
            // Each newly loaded video starts with the default, so keep it in
            // line with the setting.
            if (e.data === YT.PlayerState.PLAYING) applySubtitles(e.target, subtitles);
          },
          onApiChange: (e) => {
            if (subtitles) pickEnglishTrack(e.target);
          },
          // Skip a video that won't play, but stop once every one has failed.
          onError: (e) => {
            if (!uploads && ++failures < list.length) playNext(e.target);
            else playingRef.current?.(false);
          },
        },
      });
      saveTimer = setInterval(savePosition, SAVE_EVERY_MS);
    });

    return () => {
      cancelled = true;
      clearInterval(saveTimer);
      savePosition();
      player?.destroy();
      playerRef.current = null;
    };
  }, [slideId, idsKey, subtitles, resume, liveChannel, uploadsOf]);

  return (
    <div
      ref={hostRef}
      // Clicks pass through to the page, so its own controls keep working.
      className="absolute inset-0 pointer-events-none [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
    />
  );
}
