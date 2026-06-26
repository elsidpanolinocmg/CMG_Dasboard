"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import TickerStrip from "./TickerStrip";
import TickerCard from "./TickerCard";
import OdometerLast from "./OdometerLast";
import OdometerDaily from "./OdometerDaily";
import VideoRotatorXml from "./VideoRotatorXml";
import TopViews from "./TopViews";
import DashboardControls from "@/components/DashboardControls";

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

  // Publish the REAL visible height as --brand-h. The landscape CSS sizes the
  // shell + root to this instead of 100dvh, which on iOS does NOT report the
  // toolbar-aware height (so the page ran taller than the screen → scrolled, and
  // the scrolled load clipped the header). visualViewport.height is the true
  // visible height on iOS. No scroll-lock / fixed positioning here — once the
  // document equals the visible area it can't scroll and the browser keeps its
  // toolbar behaviour, so the header isn't clipped. (Var is only consumed by the
  // landscape ≤950 CSS; desktop/TV and portrait are unaffected.)
  useEffect(() => {
    const vv = window.visualViewport;
    const setVar = () => {
      const h = Math.round(vv?.height ?? window.innerHeight);
      document.documentElement.style.setProperty("--brand-h", `${h}px`);
    };
    setVar();
    const raf = requestAnimationFrame(setVar);
    const t1 = setTimeout(setVar, 300);
    const t2 = setTimeout(setVar, 800);
    window.addEventListener("resize", setVar);
    window.addEventListener("orientationchange", setVar);
    vv?.addEventListener("resize", setVar);
    vv?.addEventListener("scroll", setVar);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", setVar);
      window.removeEventListener("orientationchange", setVar);
      vv?.removeEventListener("resize", setVar);
      vv?.removeEventListener("scroll", setVar);
    };
  }, []);

  return (
    <div className="brand-root bg-white flex flex-col min-h-screen md:h-screen">
      <header className="brand-header flex flex-col md:flex-row items-center gap-4 md:gap-6 px-3 py-4 shrink-0 overflow-x-auto md:overflow-x-visible">
        <div className="brand-left flex justify-between w-full md:w-fit">
          {siteConfig.image && (
            <div className="brand-logo relative h-14 w-40 md:h-24 md:w-64">
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
            className="cmg-logo cmg-mobile relative h-12 w-20 md:h-24 md:w-32 cursor-pointer block md:hidden"
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

        <div className="metric-row grid grid-cols-2 gap-2 md:flex md:flex-nowrap md:justify-evenly md:gap-4 flex-1 text-gray-900">
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
              className="metric-col flex flex-col items-center text-center flex-shrink-0"
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
            className="cmg-logo cmg-corner relative h-12 w-20 md:h-24 md:w-32 cursor-pointer hidden md:block"
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

      <main className="brand-main flex-1 md:min-h-0 md:overflow-hidden flex flex-col md:flex-row items-stretch justify-center px-3 md:px-8 py-4 gap-8">
        <div className="brand-content w-full max-w-[1920px] flex flex-col md:flex-row gap-8 px-3 md:px-8">
          {showTopViews && (
            <div className="brand-news w-full md:w-[40%] flex flex-col md:h-full md:overflow-hidden">
              <TopViews
                xmlUrl={articlesFeedUrl}
                brand={brand}
                limit={10}
                onError={() => setShowTopViews(false)}
              />
            </div>
          )}
          {showVideoRotator && (
            <div className="brand-video w-full md:w-[clamp(40%,100vh,80%)] flex flex-col md:h-full md:overflow-hidden">
              <VideoRotatorXml
                xmlUrl={videosFeedUrl}
                displayTime={videoDurationTime}
                onError={() => setShowVideoRotator(false)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Static on mobile so it flows after the content (a fixed footer here
          covered the news); pinned-feel preserved on desktop/TV via h-screen. */}
      <footer className="w-full">
        <div className="flex flex-col md:space-y-0 gap-0">
          <div className="flex-1 min-w-0">
            <TickerCard
              feedUrl={exclusiveFeedUrl}
              duration={cardduration}
              fontSize="clamp(14px, 2vw, 38px)"
              height="clamp(40px, 6vh, 80px)"
            />
          </div>
          <div className="flex-1 min-w-0">
            <TickerStrip
              feedUrl={feedUrl}
              speed={stripspeed}
              fontSize="clamp(14px, 2vw, 38px)"
              height="clamp(40px, 6vh, 80px)"
            />
          </div>
        </div>
      </footer>

      {/* Same controls (Home + Fullscreen, opened via the bottom tap-zone on
          touch) as the other dashboards — the publication brand view had none. */}
      <DashboardControls />
    </div>
  );
}
