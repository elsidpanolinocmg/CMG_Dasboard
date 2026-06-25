"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardControlsProps {
  children?: ReactNode;
  className?: string;
  /** Hide the built-in Fullscreen button (e.g. pages with only a Home action). */
  showFullscreen?: boolean;
  /** When false, touch users open the panel only via the handle button (no
   *  bottom-zone tap). Desktop/non-touch always keeps the bottom-zone toggle so
   *  it behaves like every other page. */
  openOnBottomTap?: boolean;
}

export default function DashboardControls({
  children,
  className = "",
  showFullscreen = true,
  openOnBottomTap = true,
}: DashboardControlsProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Whether this browser actually supports the Fullscreen API. iPhone Safari
  // does not (the button would be a no-op), so we hide it there. Android,
  // iPad, desktop and TV browsers all report true.
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  // Mirror `visible` in a ref so the (mount-only) pointerdown listener can read
  // the current value without re-subscribing.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  // Touch devices get the tap-outside-to-close modal; desktop/TV keep auto-hide.
  const [isTouch, setIsTouch] = useState(false);
  const isTouchRef = useRef(isTouch);
  isTouchRef.current = isTouch;

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenEnabled?: boolean };
    setFullscreenSupported(
      !!(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled),
    );
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    setIsFullscreen(!!document.fullscreenElement);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setIsTouch(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Non-touch (desktop/TV): auto-hide the overlay 5s after the last activity.
  // Touch devices dismiss via the backdrop instead, so skip the timer there.
  useEffect(() => {
    if (!visible || isTouch) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 5000);
    };
    reset();
    window.addEventListener("pointermove", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [visible, isTouch]);

  // Toggle the overlay when tapping/clicking the bottom quarter of the screen.
  // A single pointer handler covers mouse + touch + pen. Using `pointerdown`
  // (instead of separate click + touchstart listeners) avoids the double-fire
  // on phones, where a tap fired touchstart AND a synthetic click — toggling
  // the overlay on then immediately off, so it never appeared.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      // Touch opens via the bottom tap-bar's click instead — opening here on
      // pointer-DOWN would mount the backdrop in time for the same tap's trailing
      // click to land on it and immediately close the panel (flash open/shut).
      if (isTouchRef.current) return;
      if (e.target instanceof Node && containerRef.current?.contains(e.target))
        return;
      // Desktop/TV: toggle via the bottom 25%/≥140px zone (no tap-bar there).
      const zone = Math.max(window.innerHeight * 0.25, 140);
      if (e.clientY < window.innerHeight - zone) return;
      setVisible((v) => !v);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openOnBottomTap]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      {/* Invisible tap-bar at the very bottom — the touch way to open the controls
          now that there's no visible handle. Anchored to the real viewport bottom
          (reliable, unlike the window.innerHeight calc which can drift on mobile),
          64px tall so it sits below page content. Desktop/TV still open via the
          bottom-zone click in the pointerdown handler. */}
      {!visible && isTouch && (
        <div
          className="fixed inset-x-0 bottom-0 h-16 z-40"
          onClick={() => setVisible(true)}
          aria-hidden="true"
        />
      )}

      {/* Touch only — closes the panel on an outside tap and blocks taps from
          reaching links/buttons behind it while the controls are open. */}
      {visible && isTouch && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setVisible(false)}
        />
      )}

      {visible && (
        <div
          ref={containerRef}
          className={`dash-controls fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex max-w-[92vw] flex-wrap items-center justify-center gap-3 rounded-2xl bg-gray-500/30 px-3 py-2 text-base shadow-lg ring-1 ring-white/15 backdrop-blur-md touch-manipulation select-none ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
          {children && (
            <span className="hidden h-8 w-px bg-white/40 sm:block" aria-hidden="true" />
          )}
          {showFullscreen && fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70"
            >
              {isFullscreen ? "Exit ⛶" : "Fullscreen ⛶"}
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70"
          >
            Home
          </button>
        </div>
      )}
    </>
  );
}
