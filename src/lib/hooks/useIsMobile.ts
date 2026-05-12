"use client";

import { useEffect, useState } from "react";

/**
 * Returns true once we've detected the viewport is narrower than the given
 * breakpoint. Defaults to 768px to match the project's Tailwind `md:` cutoff.
 *
 * SSR-safe: always returns `false` on the server and on the first client
 * render, then updates after mount, so it never causes a hydration mismatch.
 */
export function useIsMobile(breakpointPx: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [breakpointPx]);

  return isMobile;
}
