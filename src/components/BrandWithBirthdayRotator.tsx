"use client";

import { useEffect, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import BirthdaySlide, { type BirthdaySlideEntry } from "./BirthdaySlide";

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

export default function BrandWithBirthdayRotator({
  brand,
  siteConfig,
  birthdays,
  intervalMs = 60_000,
}: Props) {
  const [birthdayIdx, setBirthdayIdx] = useState<number | null>(null);
  const cursor = useRef(0);
  const regularTicks = useRef(0);

  useEffect(() => {
    if (birthdays.length === 0 || intervalMs <= 0) return;
    const t = setInterval(() => {
      setBirthdayIdx((prev) => {
        if (prev !== null) {
          // Hide birthday, reset counter — back to brand for another stretch.
          regularTicks.current = 0;
          return null;
        }
        regularTicks.current += 1;
        if (regularTicks.current >= BIRTHDAY_EVERY) {
          const next = cursor.current % birthdays.length;
          cursor.current = next + 1;
          return next;
        }
        return null;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [birthdays.length, intervalMs]);

  const active =
    birthdayIdx !== null && birthdays[birthdayIdx] ? birthdays[birthdayIdx] : null;

  return (
    <div className="relative w-full min-h-screen">
      <BrandDashboard brand={brand} siteConfig={siteConfig} />
      {active && (
        <div className="absolute inset-0 z-30">
          <BirthdaySlide entry={active} />
        </div>
      )}
    </div>
  );
}
