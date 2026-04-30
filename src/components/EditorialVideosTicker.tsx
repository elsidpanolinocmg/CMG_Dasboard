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
}

export default function EditorialVideosTicker({
  department = "editorial",
}: EditorialVideosTickerProps) {
  const [configs, setConfigs] = useState<BrandConfigs>({});

  useEffect(() => {
    const load = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
        const res = await fetch(
          `${baseUrl}/api/brands/by-department/${encodeURIComponent(department)}`,
          { cache: "force-cache" },
        );
        setConfigs((await res.json()) as BrandConfigs);
      } catch (err) {
        console.error("Failed to load brand configs:", err);
      }
    };
    load();
  }, [department]);

  const { exclusiveFeeds, newsFeeds } = useMemo(() => {
    const entries = Object.values(configs);
    return {
      exclusiveFeeds: entries.map(resolveExclusiveFeed).filter(Boolean),
      newsFeeds: entries.map(resolveNewsFeed).filter(Boolean),
    };
  }, [configs]);

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
              fontSize="clamp(20px, 2vw, 38px)"
              height="clamp(65px, 6vh, 80px)"
            />
          </div>
        )}
        {newsFeeds.length > 0 && (
          <div className="flex-1 min-w-0">
            <TickerStrip
              feedUrl={newsFeeds}
              speed={60}
              fontSize="clamp(20px, 2vw, 38px)"
              height="clamp(65px, 6vh, 80px)"
            />
          </div>
        )}
      </div>
    </footer>
  );
}
