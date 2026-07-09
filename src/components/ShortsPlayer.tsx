"use client";

import { useEffect, useRef, useState } from "react";

export interface Video {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  createdTime?: string;
  link?: string;
  tags?: string[];
}

interface ShortsPlayerProps {
  videos?: Video[];
  brand?: string;
  fetchUrl?: string;
  className?: string;
  rotationInterval?: number;
  slots?: number;
}

const WAIT_MODE_KEY = "shortsWaitMode";
const WAIT_MODE_EVENT = "shortsModeChange";

export default function ShortsPlayer({
  videos: initialVideos,
  brand,
  fetchUrl,
  className = "",
  rotationInterval = 30_000,
  slots: SLOTS = 2,
}: ShortsPlayerProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos || []);
  const [loading, setLoading] = useState(!initialVideos);
  const [error, setError] = useState<string | null>(null);
  const [slotIndexes, setSlotIndexes] = useState<number[]>(
    Array.from({ length: SLOTS }, (_, i) => i),
  );
  const [waitMode, setWaitMode] = useState(false);
  // Phones can't fit two 9:16 players side by side, so collapse to a single
  // slot on narrow screens. Starts at SLOTS to match SSR, then adjusts client-side.
  const [cols, setCols] = useState(SLOTS);
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setCols(mq.matches ? 1 : SLOTS);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [SLOTS]);

  useEffect(() => {
    if (initialVideos) return;
    const url = fetchUrl || (brand ? `/api/videos/${brand}` : "/api/videos");
    setLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch videos");
        return res.json();
      })
      .then((data) => {
        // Handle both bare array and { videos: [...] } shapes.
        const list: Video[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.videos)
            ? data.videos
            : [];
        setVideos(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [brand, fetchUrl, initialVideos]);

  useEffect(() => {
    if (initialVideos?.length) setVideos(initialVideos);
  }, [initialVideos]);

  useEffect(() => {
    const read = () => {
      setWaitMode(localStorage.getItem(WAIT_MODE_KEY) === "true");
    };
    read();
    window.addEventListener(WAIT_MODE_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(WAIT_MODE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (waitMode) return;
    if (videos.length <= cols || rotationInterval <= 0) return;
    timer.current = setInterval(() => {
      setSlotIndexes((prev) =>
        prev.map((i) => (i + cols) % videos.length),
      );
    }, rotationInterval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [waitMode, videos.length, rotationInterval, cols]);

  useEffect(() => {
    if (!waitMode) return;

    const subscribe = () => {
      iframeRefs.current.forEach((iframe) => {
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage(
          JSON.stringify({ method: "addEventListener", value: "ended" }),
          "*",
        );
      });
    };
    const subTimer = setTimeout(subscribe, 800);

    const onMessage = (e: MessageEvent) => {
      try {
        const data =
          typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event !== "ended") return;
        const slotId: string = data.player_id || "";
        const slotIdx = Number(slotId.replace("short-", ""));
        if (!Number.isInteger(slotIdx)) return;

        setSlotIndexes((prev) => {
          const next = [...prev];
          const taken = new Set(next.filter((_, i) => i !== slotIdx));
          let candidate = (next[slotIdx] + cols) % videos.length;
          let guard = 0;
          while (taken.has(candidate) && guard++ < videos.length) {
            candidate = (candidate + 1) % videos.length;
          }
          next[slotIdx] = candidate;
          return next;
        });
      } catch {
        /* ignore non-JSON messages */
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(subTimer);
      window.removeEventListener("message", onMessage);
    };
  }, [waitMode, videos.length, slotIndexes, cols]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center text-gray-400 py-12 ${className}`}
      >
        Loading shorts...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center text-red-400 py-12 ${className}`}
      >
        {error}
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div
        className={`flex items-center justify-center text-gray-500 py-12 ${className}`}
      >
        No shorts available
      </div>
    );
  }

  const loopParam = waitMode ? 0 : 1;

  return (
    <div
      className={`flex items-center justify-evenly gap-4 px-4 py-2 sm:px-6 sm:py-4 ${className}`}
    >
      {Array.from({ length: Math.min(cols, videos.length) }).map((_, slot) => {
        const video = videos[slotIndexes[slot] % videos.length];
        if (!video) return null;
        const playerId = `short-${slot}`;
        return (
          <div
            key={slot}
            className="flex flex-col items-center justify-center h-full min-h-0"
          >
            <div className="shorts-box relative h-full max-h-[calc(100%_-_3.5rem)] sm:max-h-[calc(100%_-_3.25rem)] aspect-[9/16] max-w-[92vw] overflow-hidden rounded-lg">
              <iframe
                ref={(el) => {
                  iframeRefs.current[slot] = el;
                }}
                src={`https://player.vimeo.com/video/${video.id}?badge=0&autopause=0&autoplay=1&muted=1&controls=0&loop=${loopParam}&player_id=${playerId}&app_id=58479&api=1`}
                title={video.title}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="shorts-title text-base sm:text-xl font-semibold mt-1 text-center uppercase line-clamp-2 text-gray-900">
              {video.title}
            </p>
          </div>
        );
      })}
    </div>
  );
}
