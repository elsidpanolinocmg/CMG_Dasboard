"use client";

import { useEffect, useState } from "react";

// Video backup for viewers who can't reach Vimeo (e.g. Indonesian ISPs block
// player.vimeo.com). Everyone else keeps the normal Vimeo player.
//
// Backup = our own 720p copies in Cloudflare R2, served by the
// cmg-video-fallback Worker:
//   <BASE>/v/<vimeoId>.mp4     the video file (copied on demand if missing)
//   <BASE>/embed/<vimeoId>     a player page that stands in for player.vimeo.com
export const VIDEO_BACKUP_BASE = (
  process.env.NEXT_PUBLIC_VIDEO_BACKUP_BASE || "https://video.charltonmedia.com"
).replace(/\/$/, "");

export const backupVideoUrl = (id: string | number) => `${VIDEO_BACKUP_BASE}/v/${id}.mp4`;

export function backupEmbedUrl(id: string | number, params: Record<string, string | number> = {}) {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const s = q.toString();
  return `${VIDEO_BACKUP_BASE}/embed/${id}${s ? `?${s}` : ""}`;
}

const PROBE_TIMEOUT_MS = 6000;
const FORCE_KEY = "videoFallback"; // ?videoFallback=1 (or 0) to force on/off for testing; remembered on this device

let decision: Promise<boolean> | null = null;

function forced(): boolean | null {
  try {
    const q = new URLSearchParams(window.location.search).get(FORCE_KEY);
    if (q === "1" || q === "0") localStorage.setItem(FORCE_KEY, q);
    if (q === "clear") localStorage.removeItem(FORCE_KEY);
    const v = localStorage.getItem(FORCE_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

// Country on the backup list (BACKUP_COUNTRIES on the server)?
async function countryListed(): Promise<boolean> {
  try {
    const res = await fetch("/api/video-fallback", { cache: "no-store" });
    if (!res.ok) return false;
    return !!(await res.json()).fallback;
  } catch {
    return false;
  }
}

// Can this browser reach Vimeo's player at all? A blocked network refuses the
// connection (ERR_CONNECTION_REFUSED) or never answers, which rejects or times out.
async function vimeoUnreachable(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch("https://player.vimeo.com/api/player.js", {
      mode: "no-cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return false;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** Decided once per page load and shared by every player on the page. */
export function shouldUseVideoBackup(): Promise<boolean> {
  if (!decision) {
    const f = forced();
    decision =
      f !== null
        ? Promise.resolve(f)
        : Promise.all([countryListed(), vimeoUnreachable()]).then(([a, b]) => a || b);
  }
  return decision;
}

/**
 * False until the check says the backup is needed, then true. Players start
 * with Vimeo exactly as before and only switch if the answer comes back true,
 * so viewers who can reach Vimeo see no change and no delay.
 */
export function useVideoFallback(): boolean {
  const [useBackup, setUseBackup] = useState(false);
  useEffect(() => {
    let alive = true;
    shouldUseVideoBackup().then((v) => {
      if (alive && v) setUseBackup(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return useBackup;
}
