"use client";

import { useEffect, useMemo, useState } from "react";
import TickerCard from "./TickerCard";
import TickerStrip from "./TickerStrip";

interface SiteConfig {
  url?: string;
  exclusivesUrl?: string;
  exclusiveFeed?: string;
}

type BrandConfigs = Record<string, SiteConfig>;

const stripTrailingSlash = (u?: string) => (u ? u.replace(/\/$/, "") : "");

function resolveNewsFeed(cfg: SiteConfig) {
  if (cfg?.exclusivesUrl) return cfg.exclusivesUrl;
  const base = stripTrailingSlash(cfg?.url);
  return base ? `${base}/news-feed.xml` : "";
}

function resolveExclusiveFeed(cfg: SiteConfig) {
  if (cfg?.exclusiveFeed) return cfg.exclusiveFeed;
  const base = stripTrailingSlash(cfg?.url);
  return base ? `${base}/exclusive-news-feed.xml` : "";
}

interface EditorialVideosTickerProps {
  department?: string;
  newsSource?: "site" | "event-news";
}

export default function EditorialVideosTicker({
  department = "editorial",
  newsSource = "site",
}: EditorialVideosTickerProps) {
  const [configs, setConfigs] = useState<BrandConfigs>({});

  useEffect(() => {
    let cancelled = false;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const url = `${baseUrl}/api/brands/by-department/${encodeURIComponent(department)}`;
    const delays = [0, 800, 2000, 4000];

    const attempt = async (i: number): Promise<void> => {
      if (cancelled) return;
      if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        const res = await fetch(url, { cache: i === 0 ? "force-cache" : "no-store" });
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && ct.includes("application/json")) {
          if (cancelled) return;
          setConfigs((await res.json()) as BrandConfigs);
          return;
        }
        if (i + 1 < delays.length) return attempt(i + 1);
        console.warn(
          `Brands API still returning ${res.status} after ${delays.length} attempts for department=${department}.`,
        );
      } catch (err) {
        if (i + 1 < delays.length) return attempt(i + 1);
        console.error("Failed to load brand configs:", err);
      }
    };

    attempt(0);
    return () => {
      cancelled = true;
    };
  }, [department]);

  const { exclusiveFeeds, newsFeeds } = useMemo(() => {
    const entries = Object.values(configs);
    const sitNews =
      newsSource === "event-news"
        ? entries
            .map((cfg) => stripTrailingSlash(cfg?.url))
            .filter(Boolean)
            .map((u) => `/api/event-news?url=${encodeURIComponent(u)}`)
        : entries.map(resolveNewsFeed).filter(Boolean);
    return {
      exclusiveFeeds: entries.map(resolveExclusiveFeed).filter(Boolean),
      newsFeeds: sitNews,
    };
  }, [configs, newsSource]);

  if (!exclusiveFeeds.length && !newsFeeds.length) return null;

  return (
    <footer className="fixed bottom-0 left-0 z-50 w-full md:static">
      <div
        className="flex flex-col md:space-y-0 gap-0"
        style={{ boxShadow: "0 -6px 20px rgba(0,0,0,0.25)" }}
      >
        {exclusiveFeeds.length > 0 && (
          <div className="flex-1 min-w-0">
            <TickerCard
              feedUrl={exclusiveFeeds}
              duration={4000}
              fontSize="clamp(13px, 2vw, 38px)"
              height="clamp(38px, 6vh, 80px)"
            />
          </div>
        )}
        {newsFeeds.length > 0 && (
          <div className="flex-1 min-w-0">
            <TickerStrip
              feedUrl={newsFeeds}
              speed={60}
              fontSize="clamp(13px, 2vw, 38px)"
              height="clamp(38px, 6vh, 80px)"
            />
          </div>
        )}
      </div>
    </footer>
  );
}
