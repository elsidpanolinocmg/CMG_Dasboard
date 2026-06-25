"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EditorialVideosRotator from "@/components/EditorialVideosRotator";
import EditorialVideosTicker from "@/components/EditorialVideosTicker";
import DashboardControls from "@/components/DashboardControls";
import BirthdayOverlay from "@/components/BirthdayOverlay";

interface ApiVideo {
  id: string;
  title: string;
  link?: string;
}

export default function BizzconVideosPage() {
  const [videos, setVideos] = useState<{ title: string; link: string }[]>([]);

  useEffect(() => {
    fetch("/api/videos/classified?department=bizzcon&format=long-form")
      .then((r) => r.json())
      .then((data) => {
        const list: ApiVideo[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.videos)
            ? data.videos
            : [];
        setVideos(
          list.map((v) => ({
            title: v.title,
            link: v.link || `https://vimeo.com/${v.id}`,
          })),
        );
      })
      .catch((err) => console.error("Failed to load bizzcon videos:", err));
  }, []);

  if (!videos.length) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white text-black">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
      <div className="fg-wrap flex-1 min-h-0 relative overflow-hidden bg-white">
        <div className="fg-video absolute inset-0">
          <EditorialVideosRotator videos={videos} />
        </div>
      </div>
      <EditorialVideosTicker department="bizzcon" />
      <DashboardControls>
        <Link
          href="/dashboard/bizzcon"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ← Back
        </Link>
      </DashboardControls>
      <BirthdayOverlay pageKey="dashboard/bizzcon/videos" />
      <style>{`
        .fg-video .video-title { display: none !important; }
        .fg-video .video-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .fg-video .video-area {
          position: absolute !important;
          inset: 0 !important;
          aspect-ratio: auto !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background: white !important;
        }
        .fg-video .video-layer {
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          width: 100vw !important;
          height: 56.25vw !important;
          min-height: 100vh !important;
          min-width: 177.78vh !important;
          transform: translate(-50%, -50%) !important;
          border: 0 !important;
        }
        /* Portrait: center the whole 16:9 video (and its caption) vertically in
           the space above the ticker, with the ticker pinned at the bottom. Not
           scrollable (page is 100dvh + overflow hidden). The frame is a real
           16:9 box so the caption stays inside the video. */
        @media (orientation: portrait) {
          .fg-wrap {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .fg-video {
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 16 / 9 !important;
          }
          .fg-video .video-layer {
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            transform: none !important;
          }
        }
        /* Landscape phones are wider than 16:9; bias the cover toward the top so
           heads aren't cropped, and size from the container (cqw/cqh) so Safari
           and Chrome match (viewport units diverge between them). */
        @media (orientation: landscape) and (max-width: 950px) {
          .fg-video .video-area { container-type: size; }
          .fg-video .video-layer {
            top: -14% !important;
            left: 50% !important;
            width: 100cqw !important;
            height: 56.25cqw !important;
            min-width: 177.78cqh !important;
            min-height: 100cqh !important;
            transform: translateX(-50%) !important;
          }
        }
      `}</style>
    </div>
  );
}
