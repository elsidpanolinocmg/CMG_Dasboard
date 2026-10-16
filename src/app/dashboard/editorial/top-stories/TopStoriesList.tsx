"use client";

import DashboardControls from "@/components/DashboardControls";
import { useEffect, useRef, useState } from "react";
import { EvenLogo, ViewCount, type PeriodStories } from "./TopStoriesClient";

const BRAND_RED = "#BD202E";
// What each period is called on this page (and on its buttons in the controls).
const PERIOD_NAMES: Record<string, string> = {
  daily: "Yesterday",
  weekly: "This week",
  monthly: "This month",
};
const nameOf = (p: PeriodStories) => PERIOD_NAMES[p.key] ?? p.label;
// How long each period stays up on a TV before moving to the next.
const ROTATE_MS = 20000;

// The Top 10 most-read stories per period.
// - TV / desktop: nothing to click; the periods cycle by themselves and the
//   ten stories sit in two columns of five.
// - Phones (touch screens): one column you can scroll; tapping a story opens
//   it on its site and swiping sideways switches period.
export default function TopStoriesList({ periods }: { periods: PeriodStories[] }) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = periods[periodIdx];

  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setTouch(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const step = (by: number) =>
    setPeriodIdx((i) => (i + by + periods.length) % Math.max(periods.length, 1));

  useEffect(() => {
    if (touch || periods.length < 2) return;
    const t = setTimeout(() => step(1), ROTATE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touch, periodIdx, periods.length]);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || periods.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <div
      // Everything fits on one screen (phones included), so the page never
      // scrolls; touch-pan-y still leaves sideways swipes to us.
      className="relative h-dvh w-full touch-pan-y overflow-hidden bg-black text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(189,32,46,0.18),transparent_60%)]" />

      {/* pb-16 on phones keeps the last row clear of the invisible strip at
          the bottom that opens the controls on touch screens. */}
      <main className="relative flex h-full flex-col gap-3 px-4 pt-5 pb-16 wide:px-12 wide:pt-8 wide:pb-10 roomy:gap-6 xwide:px-20">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-white/25 pb-3 wide:border-b-0 wide:pb-0">
          <div>
            <h1 className="whitespace-nowrap text-base font-bold uppercase tracking-[0.08em] roomy:text-4xl roomy:tracking-[0.15em]">
              Most read stories
            </h1>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.2em] roomy:mt-1 roomy:text-lg" style={{ color: BRAND_RED }}>
              Top 10 · {period && nameOf(period)}
            </p>
          </div>
          {/* Phones only: which period is up (swiping changes it). Big screens
              rely on the heading; the period buttons are in the controls. */}
          <div className="mb-1 flex items-center gap-1.5 wide:hidden" aria-hidden>
            {periods.map((p, i) => (
              <span
                key={p.key}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === periodIdx ? "w-5 bg-white" : "w-1.5 bg-white/35"}`}
              />
            ))}
          </div>
        </header>

        {!period || period.stories.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-white/60">
            No stories found for {period ? nameOf(period).toLowerCase() : "this period"}.
          </p>
        ) : (
          <ol
            key={period.key}
            // Phones: ten rows sharing the screen height. Big screens: two
            // columns of five.
            className="flex min-h-0 flex-1 flex-col animate-[listIn_0.6s_ease-out] wide:grid wide:grid-flow-col wide:grid-cols-2 wide:grid-rows-5 wide:gap-x-10 xwide:gap-x-16"
          >
            {period.stories.map((s, i) => {
              const content = (
                <>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white/40 text-xs font-bold roomy:h-12 roomy:w-12 roomy:text-xl">
                    {i + 1}
                  </span>
                  {/* Square logo box, same size for every site. */}
                  {s.brandLogo && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-white roomy:h-16 roomy:w-16">
                      <span className="flex roomy:hidden">
                        <EvenLogo src={s.brandLogo} alt={s.brandName} area={400} maxW={31} maxH={31} />
                      </span>
                      <span className="hidden roomy:flex">
                        <EvenLogo src={s.brandLogo} alt={s.brandName} area={1300} maxW={56} maxH={56} />
                      </span>
                    </span>
                  )}
                  <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug roomy:line-clamp-3 roomy:text-xl xwide:text-2xl">
                    {s.title}
                  </span>
                  <ViewCount views={s.views} className="shrink-0 text-[11px] tabular-nums text-white/70 roomy:text-lg" />
                </>
              );
              const rowClass = "flex min-h-0 flex-1 items-center gap-2.5 border-b border-white/15 px-1 wide:gap-4 roomy:gap-5";
              return (
                <li key={s.url} className="flex min-h-0 flex-1">
                  {touch ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={`${rowClass} active:bg-white/5`}>
                      {content}
                    </a>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </main>

      <DashboardControls>
        {periods.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setPeriodIdx(i)}
            className={`rounded-lg px-5 py-3 text-lg ${
              i === periodIdx ? "bg-white text-black" : "bg-black/40 text-white hover:bg-black/60"
            }`}
          >
            {nameOf(p)}
          </button>
        ))}
      </DashboardControls>

      <style>{`
        @keyframes listIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
