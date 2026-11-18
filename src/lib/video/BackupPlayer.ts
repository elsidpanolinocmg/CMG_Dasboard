"use client";

import { backupPosterUrl, backupVideoUrl } from "@/lib/hooks/useVideoFallback";

// Stand-in for the @vimeo/player Player, playing our backup copy in a plain
// <video> element. Implements only the methods EditorialVideosRotator uses, with
// the same promise-based shapes, so the rotator logic stays the same.
export interface BackupPlayerOptions {
  id: number;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

type Handler = () => void;

export class BackupPlayer {
  private video: HTMLVideoElement | null;
  private readyPromise: Promise<void>;
  private handlers = new Map<Handler, Handler>();

  constructor(container: HTMLElement, opts: BackupPlayerOptions) {
    const v = document.createElement("video");
    v.src = backupVideoUrl(opts.id);
    // Thumbnail shown until the first frame plays (instead of a black box).
    v.poster = backupPosterUrl(opts.id);
    v.muted = opts.muted ?? true;
    v.loop = opts.loop ?? true;
    v.autoplay = !!opts.autoplay;
    v.playsInline = true;
    // A paused preload (the rotator's "next" video) only fetches its first frame
    // and details. Downloading it in full while another video plays made the
    // playing one stutter on TVs; it switches to full download in play().
    v.preload = opts.autoplay ? "auto" : "metadata";
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.style.cssText = "width:100%;height:100%;display:block;object-fit:contain;background:#000";
    container.appendChild(v);
    this.video = v;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      if (v.readyState >= 1) return resolve();
      v.addEventListener("loadedmetadata", () => resolve(), { once: true });
      v.addEventListener("error", () => reject(new Error("backup video failed to load")), { once: true });
    });
    // Callers attach their own .catch; avoid an unhandled rejection if they don't.
    this.readyPromise.catch(() => {});
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  play(): Promise<void> {
    if (!this.video) return Promise.reject(new Error("destroyed"));
    this.video.preload = "auto";
    return this.video.play();
  }

  pause(): Promise<void> {
    this.video?.pause();
    return Promise.resolve();
  }

  getCurrentTime(): Promise<number> {
    if (!this.video) return Promise.reject(new Error("destroyed"));
    return Promise.resolve(this.video.currentTime);
  }

  // Captions come from /api/vimeo-captions (server-side, works where Vimeo is
  // blocked). Report one track so the rotator goes on to fetch them.
  getTextTracks(): Promise<{ kind: string; language: string }[]> {
    return Promise.resolve([{ kind: "captions", language: "en" }]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enableTextTrack(_language?: string, _kind?: string): Promise<void> {
    return Promise.resolve();
  }

  on(event: "playing", handler: Handler): void {
    if (!this.video || event !== "playing") return;
    const wrapped = () => handler();
    this.handlers.set(handler, wrapped);
    this.video.addEventListener("playing", wrapped);
  }

  off(event: "playing", handler: Handler): void {
    const wrapped = this.handlers.get(handler);
    if (!this.video || !wrapped || event !== "playing") return;
    this.video.removeEventListener("playing", wrapped);
    this.handlers.delete(handler);
  }

  destroy(): Promise<void> {
    const v = this.video;
    this.video = null;
    if (v) {
      v.pause();
      // Release the decoder straight away (matters on TV browsers).
      v.removeAttribute("src");
      v.load();
      v.remove();
    }
    this.handlers.clear();
    return Promise.resolve();
  }
}
