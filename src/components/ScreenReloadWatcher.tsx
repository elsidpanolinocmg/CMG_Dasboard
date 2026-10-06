"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const POLL_MS = 60 * 1000;

/**
 * Reloads the page when an admin presses "Refresh all screens". It notes the
 * reload time on first check, then reloads once the server reports a newer
 * one. Admin pages are left alone so a half-filled form isn't lost.
 */
export default function ScreenReloadWatcher() {
  const pathname = usePathname();
  const skip = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (skip) return;
    let baseline: number | null = null;
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch("/api/screens/reload", { cache: "no-store" });
        if (!res.ok) return;
        const { at } = (await res.json()) as { at: number };
        if (stopped || typeof at !== "number") return;
        if (baseline === null) baseline = at;
        else if (at > baseline) window.location.reload();
      } catch {
        /* offline for a moment — try again next tick */
      }
    };

    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [skip]);

  return null;
}
