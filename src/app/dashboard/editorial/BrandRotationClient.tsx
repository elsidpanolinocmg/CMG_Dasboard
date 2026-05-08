"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import BirthdaySlide, { type BirthdaySlideEntry } from "@/components/BirthdaySlide";

const BrandDashboard = dynamic(() => import("@/components/BrandDashboard"), { ssr: false });

export interface BrandEntry {
  brand: string;
  siteConfig: {
    name: string;
    url?: string;
    image?: string;
  };
}

type Slide =
  | { kind: "brand"; brand: BrandEntry }
  | { kind: "birthday"; entry: BirthdaySlideEntry };

interface Props {
  brands: BrandEntry[];
  birthdays?: BirthdaySlideEntry[];
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

const BIRTHDAY_INTERVAL = 5;

function buildSlides(brands: BrandEntry[], birthdays: BirthdaySlideEntry[]): Slide[] {
  const out: Slide[] = [];
  if (birthdays.length === 0 || brands.length === 0) {
    return brands.map((b) => ({ kind: "brand", brand: b }));
  }
  // Insert one birthday every BIRTHDAY_INTERVAL brand slides.
  // If brands.length < BIRTHDAY_INTERVAL, fall back to "once per cycle" — i.e.
  // append a single birthday at the end of the brand list.
  const interval = brands.length < BIRTHDAY_INTERVAL ? brands.length : BIRTHDAY_INTERVAL;
  let bi = 0;
  for (let i = 0; i < brands.length; i++) {
    out.push({ kind: "brand", brand: brands[i] });
    if ((i + 1) % interval === 0) {
      out.push({ kind: "birthday", entry: birthdays[bi % birthdays.length] });
      bi++;
    }
  }
  return out;
}

export default function BrandRotationClient({ brands, birthdays = [] }: Props) {
  const [rotationInterval, setRotationInterval] = useState(60_000);
  const [currentIndex, setCurrentIndex] = useState(0);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides = useMemo(() => buildSlides(brands, birthdays), [brands, birthdays]);

  useEffect(() => {
    if (!slides.length || rotationInterval <= 0) return;
    rotationTimer.current = setInterval(
      () => setCurrentIndex((i) => (i + 1) % slides.length),
      rotationInterval,
    );
    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current);
    };
  }, [slides, rotationInterval]);

  if (!brands.length) {
    return (
      <div className="h-screen flex items-center justify-center">
        No publications attached to editorial.
      </div>
    );
  }

  const safeIndex = currentIndex % slides.length;
  const current = slides[safeIndex];

  return (
    <div
      className="flex flex-col w-screen md:min-h-screen md:overflow-hidden overflow-y-auto overflow-x-hidden"
      tabIndex={0}
    >
      {current.kind === "brand" ? (
        <BrandDashboard
          key={current.brand.brand}
          brand={current.brand.brand}
          siteConfig={current.brand.siteConfig}
        />
      ) : (
        <BirthdaySlide key={`b-${current.entry.id}-${safeIndex}`} entry={current.entry} />
      )}
      <DashboardControls>
        <button
          onClick={() => setCurrentIndex((i) => (i - 1 + slides.length) % slides.length)}
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
          onClick={() => setCurrentIndex((i) => (i + 1) % slides.length)}
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
