"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BirthdaySlide, {
  slideHoldsScreen,
  splitRecurring,
  type BirthdaySlideEntry,
} from "./BirthdaySlide";
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
const MINUTES_PER_PAGE_MS = 60 * 1000;

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

  const { once, recurring } = useMemo(
    () => splitRecurring(isMobile ? [] : fetched ?? []),
    [isMobile, fetched],
  );
  const [birthday, endBirthday] = useSlideSchedule(once, showEveryMs, showForMs);
  // This page doesn't flip, so the channel's "every N pages" means N minutes.
  const [channel, endChannel] = useSlideSchedule(
    recurring,
    (recurring[0]?.everyPages ?? 0) * MINUTES_PER_PAGE_MS,
    showForMs,
  );

  // If both come due together the channel wins; the birthday waits its turn.
  const entry = channel ?? birthday;
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <BirthdaySlide
        key={entry.id}
        entry={entry}
        onVideoEnded={channel ? endChannel : endBirthday}
      />
    </div>
  );
}

/**
 * Shows `list` one slide at a time with `gapMs` between them. The gap is
 * counted from when a slide hides, so a long slide (a YouTube page held for
 * minutes) doesn't run straight into the next one.
 */
function useSlideSchedule(
  list: BirthdaySlideEntry[],
  gapMs: number,
  showForMs: number,
): [BirthdaySlideEntry | null, () => void] {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const cursor = useRef(0);

  useEffect(() => {
    if (list.length === 0 || gapMs <= 0) return;
    if (activeIdx === null) {
      const t = setTimeout(() => {
        const next = cursor.current % list.length;
        cursor.current = next + 1;
        setActiveIdx(next);
      }, gapMs);
      return () => clearTimeout(t);
    }
    // Slides that set their own length end through onVideoEnded; the timer
    // here is only a safety cap so a stalled video can't pin the overlay open.
    const entry = list[activeIdx];
    const holdMs =
      entry && slideHoldsScreen(entry) ? (entry.holdMs ?? 0) + 20 * 60 * 1000 : showForMs;
    const t = setTimeout(() => setActiveIdx(null), holdMs);
    return () => clearTimeout(t);
  }, [activeIdx, list, gapMs, showForMs]);

  const end = useCallback(() => setActiveIdx(null), []);
  return [activeIdx !== null ? (list[activeIdx] ?? null) : null, end];
}
