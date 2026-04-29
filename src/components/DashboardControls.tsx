"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardControlsProps {
  children?: ReactNode;
  className?: string;
}

export default function DashboardControls({
  children,
  className = "",
}: DashboardControlsProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    setIsFullscreen(!!document.fullscreenElement);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onActivity = (e: MouseEvent | TouchEvent) => {
      if (e.target instanceof Node && containerRef.current?.contains(e.target)) return;
      const y =
        e instanceof TouchEvent
          ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0
          : (e as MouseEvent).clientY;
      if (y < window.innerHeight * 0.75) return;
      setVisible((v) => !v);
    };
    window.addEventListener("click", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    return () => {
      window.removeEventListener("click", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reset = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 5000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("touchmove", reset, { passive: true });
    window.addEventListener("keydown", reset);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("touchmove", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [visible]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-32 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-3 px-3 py-2 rounded-xl bg-gray-500/30 backdrop-blur-md ring-1 ring-white/15 shadow-lg text-base ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {children && <span className="w-px h-8 bg-white/40" aria-hidden="true" />}
      <button
        onClick={toggleFullscreen}
        className="px-5 py-3 rounded bg-black/40 text-white text-lg hover:bg-black/60"
      >
        {isFullscreen ? "Exit ⛶" : "Fullscreen ⛶"}
      </button>
      <button
        onClick={() => router.push("/")}
        className="px-5 py-3 rounded bg-black/40 text-white text-lg hover:bg-black/60"
      >
        Home
      </button>
    </div>
  );
}
