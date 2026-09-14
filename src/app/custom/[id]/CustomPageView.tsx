"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import DashboardControls from "@/components/DashboardControls";

interface Props {
  title: string;
  mediaKind: "image" | "video";
  mediaPath: string;
  showTitle: boolean;
}

const IDLE_MS = 3000;

const subscribeNothing = () => () => {};
function fullscreenEnabled(): boolean {
  const doc = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

/**
 * Full-screen image or video. Fullscreen lives in the bottom control panel
 * (with Home); double-clicking anywhere also toggles it. Videos get a sound
 * toggle in the corner that fades out when the pointer is idle.
 */
export default function CustomPageView({ title, mediaKind, mediaPath, showTitle }: Props) {
  // iPhone Safari has no Fullscreen API, so the button is hidden there.
  const supported = useSyncExternalStore(subscribeNothing, fullscreenEnabled, () => false);
  const [idle, setIdle] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const cornerButton =
    "rounded-lg bg-black/50 px-4 py-2 text-white text-sm hover:bg-black/70 backdrop-blur transition-opacity duration-500";

  return (
    <div
      className={`relative w-screen h-lvh bg-black overflow-hidden flex items-center justify-center ${
        idle ? "cursor-none" : ""
      }`}
      onDoubleClick={supported ? toggleFullscreen : undefined}
    >
      {mediaKind === "image" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaPath}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaPath} alt={title} className="relative w-full h-full object-contain" />
        </>
      ) : (
        <>
          <video
            src={mediaPath}
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
            autoPlay
            muted
            loop
            playsInline
          />
          <video
            src={mediaPath}
            className="relative w-full h-full object-contain"
            autoPlay
            muted={muted}
            loop
            playsInline
          />
        </>
      )}

      {showTitle && (
        <div className="absolute inset-x-0 bottom-0 p-8 md:p-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-center pointer-events-none">
          <div className="text-2xl md:text-4xl font-semibold tracking-wide drop-shadow">
            {title}
          </div>
        </div>
      )}

      <div
        className={`absolute top-4 right-4 z-40 flex gap-2 ${
          idle ? "opacity-0 pointer-events-none" : "opacity-100"
        } transition-opacity duration-500`}
      >
        {mediaKind === "video" && (
          <button type="button" onClick={() => setMuted((m) => !m)} className={cornerButton}>
            {muted ? "🔇 Sound off" : "🔊 Sound on"}
          </button>
        )}
      </div>

      <DashboardControls />
    </div>
  );
}
