"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import BirthdaySlide, { type BirthdaySlideEntry } from "@/components/BirthdaySlide";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

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

function buildSlides(brands: BrandEntry[], birthdays: BirthdaySlideEntry[]): Slide[] {
  if (brands.length === 0) return [];
  if (birthdays.length === 0) {
    return brands.map((b) => ({ kind: "brand", brand: b }));
  }
  // Spread birthdays evenly across the brand list so EVERY birthday surfaces
  // within one full cycle. E.g. 4 brands + 2 birthdays → brand, brand, bday,
  // brand, brand, bday.
  const spacing = Math.max(1, Math.floor(brands.length / birthdays.length));
  const out: Slide[] = [];
  let bi = 0;
  for (let i = 0; i < brands.length; i++) {
    out.push({ kind: "brand", brand: brands[i] });
    if ((i + 1) % spacing === 0 && bi < birthdays.length) {
      out.push({ kind: "birthday", entry: birthdays[bi] });
      bi++;
    }
  }
  // If there are more birthdays than slots created above (birthdays > brands),
  // append the leftovers at the end of the cycle.
  while (bi < birthdays.length) {
    out.push({ kind: "birthday", entry: birthdays[bi++] });
  }
  return out;
}

export default function BrandRotationClient({ brands, birthdays: birthdaysProp = [] }: Props) {
  const isMobile = useIsMobile();
  const birthdays = isMobile ? [] : birthdaysProp;
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
