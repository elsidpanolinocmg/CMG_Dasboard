"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EditorialVideosRotator from "@/components/EditorialVideosRotator";
import EditorialVideosTicker from "@/components/EditorialVideosTicker";
import DashboardControls from "@/components/DashboardControls";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import ViewportFit from "@/components/ViewportFit";

interface SiteConfig {
  url?: string;
  videosFeed?: string;
  name?: string;
}

interface BrandEntry {
  brand: string;
  siteConfig: SiteConfig;
}

function getVideoFeed(siteConfig: SiteConfig) {
  if (siteConfig?.videosFeed) return siteConfig.videosFeed;
  const url = (siteConfig?.url ?? "").replace(/\/$/, "");
  return url ? `${url}/latest-videos.xml` : "";
}

const TV_MODE_STORAGE_KEY = "dashboard.editorial.videos.tvMode";

export default function EditorialVideosPage() {
  const [brands, setBrands] = useState<BrandEntry[]>([]);
  const [tvMode, setTvMode] = useState(false);
  const [rotatorEpoch, setRotatorEpoch] = useState(0);
  const [rotatorMounted, setRotatorMounted] = useState(true);

  const handleCycleReload = () => {
    setRotatorMounted(false);
    window.setTimeout(() => {
      setRotatorEpoch((n) => n + 1);
      setRotatorMounted(true);
    }, 2000);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(TV_MODE_STORAGE_KEY) === "1") setTvMode(true);
    } catch {}
  }, []);

  const toggleTvMode = () => {
    setTvMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TV_MODE_STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    // Use a relative URL so the request hits whatever origin served the page
    // (localhost, LAN IP, or production). An absolute NEXT_PUBLIC_SITE_URL would
    // point a remote device's browser back at itself and fail to load.
    const url = `/api/brands/by-department/editorial`;
    const delays = [0, 800, 2000, 4000];

    const attempt = async (i: number): Promise<void> => {
      if (cancelled) return;
      if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        const res = await fetch(url, { cache: i === 0 ? "force-cache" : "no-store" });
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && ct.includes("application/json")) {
          if (cancelled) return;
          const config = (await res.json()) as Record<string, SiteConfig>;
          setBrands(
            Object.entries(config).map(([brand, siteConfig]) => ({
              brand,
              siteConfig,
            })),
          );
          return;
        }
        if (i + 1 < delays.length) return attempt(i + 1);
        console.warn(
          `Brands API still returning ${res.status} after ${delays.length} attempts; reload the page.`,
        );
      } catch (err) {
        if (i + 1 < delays.length) return attempt(i + 1);
        console.error("Failed to load brands:", err);
      }
    };

    attempt(0);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!brands.length) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white text-black">
        Loading…
      </div>
    );
  }

  const feedUrls = brands.map((b) => getVideoFeed(b.siteConfig)).filter(Boolean);

  return (
    <div className="h-lvh pt-safe bg-white flex flex-col overflow-hidden">
      <ViewportFit />
      <div className="fg-wrap flex-1 min-h-0 relative overflow-hidden bg-white">
        <div className="fg-video absolute inset-0">
          {rotatorMounted ? (
            <EditorialVideosRotator
              key={rotatorEpoch}
              xmlUrl={feedUrls}
              tvMode={tvMode}
              onCycleReload={handleCycleReload}
            />
          ) : (
            <div className="w-full h-full bg-black" />
          )}
        </div>
      </div>
      <EditorialVideosTicker />
      <DashboardControls>
        <Link
          href="/dashboard/editorial"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ← Back
        </Link>
        <button
          onClick={toggleTvMode}
          className={`px-4 py-2 rounded text-white ${tvMode ? "bg-red-600/80 hover:bg-red-600" : "bg-black/40 hover:bg-black/60"}`}
          title="Enables end-of-cycle auto-reload and mid-playback stall detection for TV browsers"
        >
          TV Mode: {tvMode ? "ON" : "OFF"}
        </button>
      </DashboardControls>
      <BirthdayOverlay pageKey="dashboard/editorial/videos" />
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
        /* Portrait (phones held upright): center the whole 16:9 video (and its
           caption) vertically in the space above the ticker, with the ticker
           pinned at the bottom. Not scrollable — the page is exactly 100dvh with
           overflow hidden. The video frame is a real 16:9 box so the caption,
           which is positioned relative to it, stays inside the video. */
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
        /* Landscape phones are wider than 16:9, so the cover-crop trims the top
           and bottom equally and cuts off reporters' heads. Bias the video toward
           the TOP so heads stay visible, but shift up slightly so a little is
           given back to the bottom rather than pinning fully to the top edge.
           Size the cover from the video CONTAINER (cqw/cqh) instead of the
           viewport (vw/vh): viewport units resolve differently in Safari vs
           Chrome (toolbar handling), which left a white strip at the top in
           Safari. Container units are identical across browsers and account for
           the ticker height. */
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
