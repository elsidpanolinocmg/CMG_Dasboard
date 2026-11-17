"use client";

import { backupEmbedUrl, useVideoFallback } from "@/lib/hooks/useVideoFallback";

interface VimeoEmbedProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  aspectRatio?: "16/9" | "9/16" | "1/1";
}

const ASPECT_PADDING: Record<string, string> = {
  "16/9": "56.25%",
  "9/16": "177.78%",
  "1/1": "100%",
};

export default function VimeoEmbed({
  videoId,
  title = "",
  autoplay = false,
  muted = false,
  loop = false,
  className = "",
  aspectRatio = "16/9",
}: VimeoEmbedProps) {
  const params = new URLSearchParams({
    badge: "0",
    autopause: "0",
    player_id: "0",
    app_id: "58479",
  });
  if (autoplay) params.set("autoplay", "1");
  if (muted) params.set("muted", "1");
  if (loop) params.set("loop", "1");

  // Vimeo unreachable here (e.g. Indonesia): our backup player page instead.
  const useBackup = useVideoFallback();
  const src = useBackup
    ? backupEmbedUrl(videoId, { autoplay: autoplay ? 1 : 0, muted: muted ? 1 : 0, loop: loop ? 1 : 0 })
    : `https://player.vimeo.com/video/${videoId}?${params}`;

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ paddingBottom: ASPECT_PADDING[aspectRatio] }}
    >
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
