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

export default function AwardsVideosPage() {
  const [videos, setVideos] = useState<{ title: string; link: string }[]>([]);

  useEffect(() => {
    fetch("/api/videos/classified?department=awards&format=long-form")
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
      .catch((err) => console.error("Failed to load awards videos:", err));
  }, []);

  if (!videos.length) {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-black">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white">
        <div className="fg-video absolute inset-0">
          <EditorialVideosRotator videos={videos} />
        </div>
      </div>
      <EditorialVideosTicker department="awards" newsSource="event-news" />
      <DashboardControls>
        <Link
          href="/dashboard/awards"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ← Back
        </Link>
      </DashboardControls>
      <BirthdayOverlay pageKey="dashboard/awards/videos" />
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
        @media (max-width: 767px) and (orientation: portrait) {
          .fg-video .video-area { background: #fff !important; }
          .fg-video .video-layer {
            min-width: 0 !important;
            min-height: 0 !important;
            width: 100vw !important;
            height: 56.25vw !important;
          }
        }
      `}</style>
    </div>
  );
}
