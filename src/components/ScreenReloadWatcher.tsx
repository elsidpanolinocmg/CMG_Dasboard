"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const POLL_MS = 60 * 1000;

/**
 * Acts on the admin's "Refresh all screens" buttons. It notes the request
 * times on first check, then reacts to newer ones:
 * - full: reloads the page (picks up a new deploy; the browser drops fullscreen)
 * - soft: re-reads the page's server data and rebuilds the page in place, so
 *   everything fetches afresh while a fullscreen screen stays fullscreen
 * Admin pages are left alone so a half-filled form isn't lost.
 */
export default function ScreenReloadWatcher({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const skip = pathname?.startsWith("/admin") ?? false;
  // Bumping this remounts the whole page below, so its components fetch anew.
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (skip) return;
    let baseline: { at: number; softAt: number } | null = null;
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch("/api/screens/reload", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { at?: number; softAt?: number };
        if (stopped) return;
        const at = typeof data.at === "number" ? data.at : 0;
        const softAt = typeof data.softAt === "number" ? data.softAt : 0;
        if (baseline === null) {
          baseline = { at, softAt };
        } else if (at > baseline.at) {
          window.location.reload();
        } else if (softAt > baseline.softAt) {
          baseline.softAt = softAt;
          router.refresh();
          setEpoch((n) => n + 1);
        }
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
  }, [skip, router]);

  return <Fragment key={epoch}>{children}</Fragment>;
}
