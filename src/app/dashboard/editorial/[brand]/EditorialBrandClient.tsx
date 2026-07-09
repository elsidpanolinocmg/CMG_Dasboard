"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardControls from "@/components/DashboardControls";

const BrandDashboard = dynamic(() => import("@/components/BrandDashboard"), { ssr: false });

const DEFAULTS = {
  stripspeed: 60,
  cardduration: 4_000,
  activeNowIntervalms: 10_000,
  activeTodayIntervalms: 60_000,
  videoDisplayTime: 30,
};

interface Props {
  brand: string;
  siteConfig: { name: string; url?: string; image?: string };
}

function readNum(sp: URLSearchParams, key: string, def: number): number {
  const v = sp.get(key);
  if (v === null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default function EditorialBrandClient({ brand, siteConfig }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stripspeed = readNum(searchParams, "stripspeed", DEFAULTS.stripspeed);
  const cardduration = readNum(searchParams, "cardduration", DEFAULTS.cardduration);
  const activeNowIntervalms = readNum(
    searchParams,
    "activeNowIntervalms",
    DEFAULTS.activeNowIntervalms,
  );
  const activeTodayIntervalms = readNum(
    searchParams,
    "activeTodayIntervalms",
    DEFAULTS.activeTodayIntervalms,
  );
  const videoDisplayTime = readNum(searchParams, "videoDisplayTime", DEFAULTS.videoDisplayTime);
  const autoFullscreen = searchParams.get("fullscreen") === "1";

  useEffect(() => {
    if (!autoFullscreen) return;
    document.documentElement.requestFullscreen().catch(() => {});
  }, [autoFullscreen]);

  return (
    <div className="brand-shell flex flex-col w-screen min-h-screen overflow-hidden">
      <BrandDashboard
        key={searchParams.toString()}
        brand={brand}
        siteConfig={siteConfig}
        stripspeed={stripspeed}
        cardduration={cardduration}
        activeNowIntervalms={activeNowIntervalms}
        activeTodayIntervalms={activeTodayIntervalms}
        videoDurationTime={videoDisplayTime}
      />
      <DashboardControls>
        <button
          onClick={() => router.push(`/dashboard/editorial/settings?${searchParams.toString()}`)}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ⚙ Settings
        </button>
        <Link
          href="/dashboard/editorial"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          All editorial
        </Link>
        <Link
          href="/admin"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ⚙ Admin
        </Link>
      </DashboardControls>
    </div>
  );
}
