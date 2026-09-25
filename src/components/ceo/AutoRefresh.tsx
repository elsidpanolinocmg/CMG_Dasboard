"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps a wall-mounted CEO board current without anyone touching it: every
 * `intervalMs` it quietly re-renders from the server, holding the current screen
 * while it does (no flash, and the card rotation keeps its place).
 *
 * It goes through the boards' cache, so a tick is cheap — the sheet is only read
 * once a cached copy has aged. Ticks are skipped while the tab is hidden, and a
 * screen that wakes after sitting past its interval catches up straight away.
 */
export function AutoRefresh({ intervalMs = 5 * 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    lastRefresh.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      lastRefresh.current = Date.now();
      router.refresh();
    };
    const timer = setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current >= intervalMs) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
