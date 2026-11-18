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
// The video's thumbnail (through our server, since Vimeo's image host is blocked too).
export const backupPosterUrl = (id: string | number) => `${VIDEO_BACKUP_BASE}/p/${id}.jpg`;

export function backupEmbedUrl(id: string | number, params: Record<string, string | number> = {}) {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const s = q.toString();
  return `${VIDEO_BACKUP_BASE}/embed/${id}${s ? `?${s}` : ""}`;
}

const PROBE_TIMEOUT_MS = 6000;
// Testing switch in the page link:
//   ?videoFallback=1      backup for this link only (nothing saved)
//   ?videoFallback=0      Vimeo for this link only
//   ?videoFallback=save   backup on this device until cleared (e.g. a TV)
//   ?videoFallback=clear  forget the saved choice, back to the automatic check
const FORCE_KEY = "videoFallback";

let decision: Promise<boolean> | null = null;

function forced(): boolean | null {
  try {
    const q = new URLSearchParams(window.location.search).get(FORCE_KEY);
    if (q === "save") localStorage.setItem(FORCE_KEY, "1");
    if (q === "clear") localStorage.removeItem(FORCE_KEY);
    if (q === "1" || q === "save") return true;
    if (q === "0") return false;
    // Only "save" is remembered (older versions saved "0" too).
    return localStorage.getItem(FORCE_KEY) === "1" ? true : null;
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

/**
 * The link's ?videoFallback= wins, checked on every page (the dashboard moves
 * between pages without reloading). Otherwise the country + Vimeo check runs
 * once and is shared by every player.
 */
export function shouldUseVideoBackup(): Promise<boolean> {
  const f = forced();
  if (f !== null) return Promise.resolve(f);
  if (!decision) {
    decision = Promise.all([countryListed(), vimeoUnreachable()]).then(([a, b]) => a || b);
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
