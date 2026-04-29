"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import TickerStrip from "./TickerStrip";
import TickerCard from "./TickerCard";
import OdometerLast from "./OdometerLast";
import OdometerDaily from "./OdometerDaily";
import VideoRotatorXml from "./VideoRotatorXml";
import TopViews from "./TopViews";

export interface BrandSiteConfig {
  name: string;
  url?: string;
  image?: string;
  exclusivesUrl?: string;
  exclusiveFeed?: string;
  videosFeed?: string;
  ArticlesFeed?: string;
}

interface Props {
  brand: string;
  siteConfig: BrandSiteConfig;
  stripspeed?: number;
  cardduration?: number;
  activeNowIntervalms?: number;
  activeTodayIntervalms?: number;
  videoDurationTime?: number;
}

export default function BrandDashboard({
  brand,
  siteConfig,
  stripspeed = 100,
  cardduration = 4000,
  activeNowIntervalms = 10_000,
  activeTodayIntervalms = 60_000,
  videoDurationTime = 30,
}: Props) {
  const safe = (u?: string) => (u ? u.replace(/\/$/, "") : "");

  const feedUrl = siteConfig.exclusivesUrl ?? safe(siteConfig.url) + "/news-feed.xml";
  const exclusiveFeedUrl =
    siteConfig.exclusiveFeed ?? safe(siteConfig.url) + "/exclusive-news-feed.xml";
  const videosFeedUrl =
    siteConfig.videosFeed ?? safe(siteConfig.url) + "/latest-videos.xml";
  const articlesFeedUrl =
    siteConfig.ArticlesFeed ?? safe(siteConfig.url) + "/top-read-feed.xml";

  const [showTopViews, setShowTopViews] = useState(true);
  const [showVideoRotator, setShowVideoRotator] = useState(true);

  useEffect(() => {
    if (!articlesFeedUrl) setShowTopViews(false);
    if (!videosFeedUrl) setShowVideoRotator(false);
  }, [articlesFeedUrl, videosFeedUrl]);

  return (
    <div className="bg-white flex flex-col min-h-screen md:h-screen">
      <header className="flex flex-col md:flex-row items-center gap-4 md:gap-6 px-3 py-4 shrink-0 overflow-x-auto md:overflow-x-visible">
        <div className="flex justify-between w-full md:w-fit">
          {siteConfig.image && (
            <div className="relative h-14 w-40 md:h-24 md:w-64">
              <Image
                src={`/${siteConfig.image}`}
                alt={siteConfig.name}
                fill
                className="object-contain"
                priority
                unoptimized
              />
            </div>
          )}
          <div
            onClick={() => (window.location.href = "/dashboard")}
            className="relative h-12 w-20 md:h-24 md:w-32 cursor-pointer block md:hidden"
            title="Home"
          >
            <Image
              src="/logo/cmg.png"
              alt="Charlton Media Group"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:flex-nowrap md:justify-evenly md:gap-4 flex-1 text-gray-900">
          {[
            {
              label: "Active Users Last 365 Days",
              url: `/api/active-365-days/${brand}`,
              type: "daily" as const,
            },
            {
              label: "Active Users Last 30 Days",
              url: `/api/active-30-days/${brand}`,
              type: "daily" as const,
            },
            {
              label: "Active Users Today",
              url: `/api/active-today/${brand}`,
              type: "last" as const,
              intervalms: activeTodayIntervalms,
            },
            {
              label: "Active Users Now",
              url: `/api/active-now/${brand}`,
              type: "last" as const,
              intervalms: activeNowIntervalms,
            },
          ].map((m) => (
            <div
              key={m.label}
              className="flex flex-col items-center text-center flex-shrink-0"
            >
              <p className="text-xs md:text-sm">{m.label}</p>
              {m.type === "daily" ? (
                <OdometerDaily fetchUrl={m.url} />
              ) : (
                <OdometerLast fetchUrl={m.url} intervalms={m.intervalms} />
              )}
            </div>
          ))}
        </div>

        <div className="flex w-fit">
          <div
            onClick={() => (window.location.href = "/dashboard")}
            className="relative h-12 w-20 md:h-24 md:w-32 cursor-pointer hidden md:block"
            title="Home"
          >
            <Image
              src="/logo/cmg.png"
              alt="Charlton Media Group"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
        </div>
      </header>

      <main className="flex-1 md:min-h-0 md:overflow-hidden flex flex-col md:flex-row items-stretch justify-center px-3 md:px-8 py-4 gap-8 pb-[100px]">
        <div className="w-full max-w-[1920px] flex flex-col md:flex-row gap-8 px-3 md:px-8">
          {showTopViews && (
            <div className="w-full md:w-[40%] flex flex-col h-full overflow-hidden">
              <TopViews
                xmlUrl={articlesFeedUrl}
                brand={brand}
                limit={10}
                onError={() => setShowTopViews(false)}
              />
            </div>
          )}
          {showVideoRotator && (
            <div className="w-full md:w-[clamp(40%,100vh,80%)] flex flex-col h-full overflow-hidden">
              <VideoRotatorXml
                xmlUrl={videosFeedUrl}
                displayTime={videoDurationTime}
                onError={() => setShowVideoRotator(false)}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 z-50 w-full md:static">
        <div className="flex flex-col md:space-y-0 gap-0">
          <div className="flex-1 min-w-0">
            <TickerCard
              feedUrl={exclusiveFeedUrl}
              duration={cardduration}
              fontSize="clamp(20px, 2vw, 38px)"
              height="clamp(65px, 6vh, 80px)"
            />
          </div>
          <div className="flex-1 min-w-0">
            <TickerStrip
              feedUrl={feedUrl}
              speed={stripspeed}
              fontSize="clamp(20px, 2vw, 38px)"
              height="clamp(65px, 6vh, 80px)"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
