"use client";

import { useEffect, useState } from "react";
import VimeoEmbed from "./VimeoEmbed";

export interface RotatorVideo {
  id: string;
  title: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

interface VideoRotatorProps {
  videos: RotatorVideo[];
  intervalMs?: number;
  aspectRatio?: "16/9" | "9/16";
  autoplay?: boolean;
}

export default function VideoRotator({
  videos,
  intervalMs = 30_000,
  aspectRatio = "16/9",
  autoplay = true,
}: VideoRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (videos.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % videos.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [videos.length, intervalMs]);

  if (videos.length === 0) {
    return (
      <div className="w-full aspect-video flex items-center justify-center border border-black/10 dark:border-white/10 rounded-lg text-sm opacity-60">
        No videos available.
      </div>
    );
  }

  const current = videos[index];

  return (
    <div className="flex flex-col gap-2">
      <VimeoEmbed
        key={current.id}
        videoId={current.id}
        title={current.title}
        autoplay={autoplay}
        muted={autoplay}
        aspectRatio={aspectRatio}
        className="rounded-lg"
      />
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="opacity-80 truncate">{current.title}</div>
        <div className="text-xs opacity-50 shrink-0">
          {index + 1} / {videos.length}
        </div>
      </div>
    </div>
  );
}
