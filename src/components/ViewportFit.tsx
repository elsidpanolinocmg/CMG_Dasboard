"use client";

import { useEffect } from "react";

/**
 * 1% of the REAL visible viewport height, as a CSS length. Use it in inline
 * styles as `calc(N * ${LVH_UNIT})`, or use the `.h-lvh` utility (= full visible
 * height) for a page root. Falls back to `1dvh` before JS / on SSR, so pages
 * render correctly even without <ViewportFit /> mounted (just not toolbar-aware).
 */
export const LVH_UNIT = "var(--lvh, 1dvh)";

/**
 * Sizes a full-screen dashboard to the REAL visible viewport.
 *
 * Safari (iPhone AND iPad) reports `dvh` / `100vh` / `innerHeight` as the
 * toolbar/tab-bar-HIDDEN (taller) height, so a `dvh`-sized page overran the
 * visible area and its bottom (ticker, total row, last cards) clipped under the
 * tab bar. `visualViewport.height` is the toolbar-aware visible height in BOTH
 * Safari and Chrome — we expose 1% of it as the `--lvh` CSS variable on <html>
 * and re-measure on resize / orientation / visualViewport events. We also lock
 * the document scroll, since these are fixed dashboards where any overscroll
 * (which momentarily hides the toolbar, then snaps back) re-introduces the
 * mismatch.
 *
 * Renders nothing. Drop one into any full-screen dashboard page and size the
 * root with the `h-lvh` class (or `calc(... * var(--lvh, 1dvh))` for parts).
 */
export default function ViewportFit() {
  useEffect(() => {
    const html = document.documentElement;
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      // --lvh = 1% of the visible height, for `calc(N * var(--lvh))` row sizing
      // (used in inline styles, which the browser parses directly).
      // --vvh = the FULL visible height, for the `.h-lvh` utility. It needs its
      // own var because a CSS *class* can't use the multiply form: Lightning CSS
      // (Tailwind v4) rewrites `calc(100 * var(--lvh, 1dvh))` into a bogus
      // `100lvh`, dropping the variable. A plain `var()` survives untouched.
      html.style.setProperty("--lvh", `${h / 100}px`);
      html.style.setProperty("--vvh", `${h}px`);
    };
    apply();
    // Safari settles the toolbar/tab-bar height a beat after load + rotate, so
    // re-measure on the next frame and after a short delay as well as on events.
    const raf = requestAnimationFrame(apply);
    const t = setTimeout(apply, 300);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      html.style.removeProperty("--lvh");
      html.style.removeProperty("--vvh");
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);
  return null;
}
