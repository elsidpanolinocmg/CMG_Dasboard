"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import BirthdaySlide, { type BirthdaySlideEntry } from "./BirthdaySlide";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

const BrandDashboard = nextDynamic(() => import("./BrandDashboard"), { ssr: false });

interface Props {
  brand: string;
  siteConfig: {
    name: string;
    url?: string;
    image?: string;
  };
  birthdays: BirthdaySlideEntry[];
  intervalMs?: number;
}

const BIRTHDAY_EVERY = 5;
// Safety valve: never hold a "finish video" slide longer than this many ticks
// while waiting for it to end, in case the video stalls and never fires onEnded.
const MAX_AWAIT_TICKS = 20;

export default function BrandWithBirthdayRotator({
  brand,
  siteConfig,
  birthdays: birthdaysProp,
  intervalMs = 60_000,
}: Props) {
  const isMobile = useIsMobile();
  const birthdays = isMobile ? [] : birthdaysProp;
  const [birthdayIdx, setBirthdayIdx] = useState<number | null>(null);
  const cursor = useRef(0);
  const regularTicks = useRef(0);
  // While a "finish video" slide is on screen we wait for the video to end
  // rather than hiding it on the next tick. awaitTicks bounds that wait.
  const awaitingVideoEnd = useRef(false);
  const awaitTicks = useRef(0);

  useEffect(() => {
    if (birthdays.length === 0 || intervalMs <= 0) return;
    const t = setInterval(() => {
      setBirthdayIdx((prev) => {
        if (prev !== null) {
          // A "finish video" slide stays put until the video ends (handled by
          // onVideoEnded), unless it overruns the safety cap.
          if (awaitingVideoEnd.current) {
            awaitTicks.current += 1;
            if (awaitTicks.current < MAX_AWAIT_TICKS) return prev;
            awaitingVideoEnd.current = false;
            awaitTicks.current = 0;
          }
          // Hide birthday, reset counter — back to brand for another stretch.
          regularTicks.current = 0;
          return null;
        }
        regularTicks.current += 1;
        if (regularTicks.current >= BIRTHDAY_EVERY) {
          const next = cursor.current % birthdays.length;
          cursor.current = next + 1;
          const entry = birthdays[next];
          if (entry?.mediaKind === "video" && entry.finishVideo) {
            awaitingVideoEnd.current = true;
            awaitTicks.current = 0;
          }
          return next;
        }
        return null;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [birthdays.length, intervalMs]);

  const handleVideoEnded = useCallback(() => {
    if (!awaitingVideoEnd.current) return;
    awaitingVideoEnd.current = false;
    awaitTicks.current = 0;
    regularTicks.current = 0;
    setBirthdayIdx(null);
  }, []);

  const active =
    birthdayIdx !== null && birthdays[birthdayIdx] ? birthdays[birthdayIdx] : null;

  return (
    <div className="relative w-full min-h-screen">
      <BrandDashboard brand={brand} siteConfig={siteConfig} />
      {active && (
        <div className="absolute inset-0 z-30">
          <BirthdaySlide entry={active} onVideoEnded={handleVideoEnded} />
        </div>
      )}
    </div>
  );
}
