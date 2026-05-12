"use client";

import { useEffect, useRef, useState } from "react";
import BirthdaySlide, { type BirthdaySlideEntry } from "./BirthdaySlide";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface Props {
  /** Page key matching one of BIRTHDAY_PAGE_KEYS. The API filters by this. */
  pageKey: string;
  /** Optional — if provided, skip the API fetch. Useful for SSR-fed pages. */
  birthdays?: BirthdaySlideEntry[];
  /** How often to surface a birthday slide (ms). Default 5 min. */
  showEveryMs?: number;
  /** How long the slide stays visible (ms). Default 30 sec. */
  showForMs?: number;
}

const REFRESH_MS = 30 * 60 * 1000; // re-fetch list every 30 min

/**
 * Drop-in birthday slide overlay. Fetches today's birthdays itself, then
 * cycles through them on a fixed cadence. Hidden on mobile (< 768px).
 *
 * Renders a full-screen fixed overlay above page content (z-50). Pages don't
 * need to reserve any layout space.
 */
export default function BirthdayOverlay({
  pageKey,
  birthdays: birthdaysProp,
  showEveryMs = 5 * 60 * 1000,
  showForMs = 30 * 1000,
}: Props) {
  const isMobile = useIsMobile();
  const [fetched, setFetched] = useState<BirthdaySlideEntry[] | null>(
    birthdaysProp ?? null,
  );
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const cursor = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch list from API if not provided. Refresh every 30 min so a dashboard
  // left running overnight picks up tomorrow's birthdays.
  useEffect(() => {
    if (birthdaysProp || isMobile) return;
    let cancelled = false;
    const load = async () => {
      try {
        const url = `/api/birthdays/today?page=${encodeURIComponent(pageKey)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as BirthdaySlideEntry[];
        if (!cancelled) setFetched(data);
      } catch {
        /* ignore — overlay just stays empty */
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [birthdaysProp, isMobile, pageKey]);

  const list = isMobile ? [] : fetched ?? [];

  useEffect(() => {
    if (list.length === 0 || showEveryMs <= 0) return;
    const showTimer = setInterval(() => {
      const next = cursor.current % list.length;
      cursor.current = next + 1;
      setActiveIdx(next);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setActiveIdx(null), showForMs);
    }, showEveryMs);
    return () => {
      clearInterval(showTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [list.length, showEveryMs, showForMs]);

  if (activeIdx === null) return null;
  const entry = list[activeIdx];
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <BirthdaySlide entry={entry} />
    </div>
  );
}
