"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";

const BrandDashboard = dynamic(() => import("@/components/BrandDashboard"), { ssr: false });

export interface BrandEntry {
  brand: string;
  siteConfig: {
    name: string;
    url?: string;
    image?: string;
  };
}

interface Props {
  brands: BrandEntry[];
}

const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "1 min 30 sec", value: 90_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "3 minutes", value: 180_000 },
  { label: "5 minutes", value: 300_000 },
];

export default function BrandRotationClient({ brands }: Props) {
  const [rotationInterval, setRotationInterval] = useState(60_000);
  const [currentIndex, setCurrentIndex] = useState(0);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!brands.length || rotationInterval <= 0) return;
    rotationTimer.current = setInterval(
      () => setCurrentIndex((i) => (i + 1) % brands.length),
      rotationInterval,
    );
    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current);
    };
  }, [brands, rotationInterval]);

  if (!brands.length) {
    return (
      <div className="h-screen flex items-center justify-center">
        No publications attached to editorial.
      </div>
    );
  }

  const current = brands[currentIndex];

  return (
    <div
      className="flex flex-col w-screen md:min-h-screen md:overflow-hidden overflow-y-auto overflow-x-hidden"
      tabIndex={0}
    >
      <BrandDashboard
        key={current.brand}
        brand={current.brand}
        siteConfig={current.siteConfig}
      />
      <DashboardControls>
        <button
          onClick={() => setCurrentIndex((i) => (i - 1 + brands.length) % brands.length)}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          ◀ Prev
        </button>
        <select
          value={rotationInterval}
          onChange={(e) => setRotationInterval(Number(e.target.value))}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {ROTATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCurrentIndex((i) => (i + 1) % brands.length)}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          Next ▶
        </button>
        <div className="flex flex-col gap-1">
          <Link
            href="/dashboard/editorial/shorts"
            className="px-4 py-1 rounded bg-black/40 text-white hover:bg-black/60 text-center text-sm"
          >
            Shorts
          </Link>
          <Link
            href="/dashboard/editorial/videos"
            className="px-4 py-1 rounded bg-black/40 text-white hover:bg-black/60 text-center text-sm"
          >
            Videos
          </Link>
          <Link
            href="/dashboard/editorial/leaderboard"
            className="px-4 py-1 rounded bg-black/40 text-white hover:bg-black/60 text-center text-sm"
          >
            Leaderboard
          </Link>
        </div>
      </DashboardControls>
    </div>
  );
}
