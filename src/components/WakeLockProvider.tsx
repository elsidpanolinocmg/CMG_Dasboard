"use client";

import { useEffect, useRef } from "react";

export default function WakeLockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wakeLockRef = useRef<{ release?: () => void } | null>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          const wl = await (navigator as unknown as {
            wakeLock: { request: (type: string) => Promise<{ release?: () => void; addEventListener?: (e: string, fn: () => void) => void }> };
          }).wakeLock.request("screen");
          wakeLockRef.current = wl;
          wl.addEventListener?.("release", () => {});
        }
      } catch {}
    };
    requestWakeLock();
    const onVis = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wakeLockRef.current?.release?.();
    };
  }, []);

  return <>{children}</>;
}
