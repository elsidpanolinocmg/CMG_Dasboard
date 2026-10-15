"use client";

import DashboardControls from "@/components/DashboardControls";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type Story = {
  url: string;
  title: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  body: string[];
  tags?: string[];
  truncated?: boolean;
  views: number;
  brand: string;
  brandName: string;
  brandLogo: string | null;
};

export type PeriodStories = {
  key: string;
  label: string;
  stories: Story[];
};

const BRAND_RED = "#BD202E";
// Typing speed: characters added per tick, and the tick length.
// ~36 characters a second: brisk, but still easy to read along with.
const CHARS_PER_TICK = 1;
const TICK_MS = 28;
// Beats that mimic someone reading: longest after a paragraph, then a
// sentence, then a comma (or semicolon/colon).
const PARAGRAPH_PAUSE_MS = 1000;
const SENTENCE_PAUSE_MS = 450;
const COMMA_PAUSE_MS = 180;

// Maps a typed-character count to the pause owed once typing reaches it.
// Punctuation only counts when a space or the paragraph end follows, so
// "$2.86b" and "1,255" don't stutter.
function readingPauses(body: string[]): Map<number, number> {
  const pauses = new Map<number, number>();
  let offset = 0;
  for (const para of body) {
    for (let i = 0; i < para.length - 1; i++) {
      if (para[i + 1] !== " ") continue;
      if (/[.!?]/.test(para[i])) pauses.set(offset + i + 1, SENTENCE_PAUSE_MS);
      else if (/[,;:]/.test(para[i])) pauses.set(offset + i + 1, COMMA_PAUSE_MS);
    }
    offset += para.length;
    pauses.set(offset, PARAGRAPH_PAUSE_MS);
  }
  return pauses;
}
// How long the finished story stays up before moving on.
const HOLD_AFTER_TYPING_MS = 15000;
// How long a period with nothing to show stays up before moving on.
const EMPTY_HOLD_MS = 8000;
// Share of the body typed before the "Up next" hint fades in.
const UP_NEXT_AT = 0.85;

const nf = new Intl.NumberFormat("en-US");

// Left-panel choreography. Elements enter one after another (image first, tag
// last) and leave in reverse; the period only switches once the exit is done.
const EXIT_MS = 750;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
// The headline types out quickly once it has risen in; the body waits for it.
const TITLE_START_MS = 650;
const TITLE_TICK_MS = 16;
// Short beat between the finished headline and the body starting to type.
const BODY_START_DELAY_MS = 700;

function stagger(
  leaving: boolean,
  enter: { name: string; delay: number; duration?: number },
  exit: { name: string; delay: number },
): React.CSSProperties {
  return {
    animation: leaving
      ? `${exit.name} 0.45s ease-in ${exit.delay}s both`
      : `${enter.name} ${enter.duration ?? 0.7}s ${EASE_OUT} ${enter.delay}s both`,
  };
}

// Short wording for the "#1 ..." tag on the image.
const PERIOD_TAGS: Record<string, string> = {
  daily: "Yesterday",
  weekly: "This week",
  monthly: "This month",
};

function ViewCount({ views, className = "" }: { views: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={`${nf.format(views)} views`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[1.1em] w-[1.1em]" aria-label="views">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {nf.format(views)}
    </span>
  );
}

// A brand without a trimmed logo copy falls back to its original file.
function fallBackToOriginalLogo(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.includes("/logo/trimmed/")) img.src = img.src.replace("/logo/trimmed/", "/logo/");
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  // Month first, e.g. "Oct 14, 2026".
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TopStoriesClient({ periods }: { periods: PeriodStories[] }) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [titleDone, setTitleDone] = useState(false);
  const markTitleDone = useCallback(() => setTitleDone(true), []);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const period = periods[periodIdx];
  const top = period?.stories[0];
  const upNextPeriod = periods.length > 1 ? periods[(periodIdx + 1) % periods.length] : undefined;
  const upNext = upNextPeriod?.stories[0]
    ? { label: PERIOD_TAGS[upNextPeriod.key] ?? upNextPeriod.label, story: upNextPeriod.stories[0] }
    : null;

  // Play the exit, then switch period (which plays the next entrance).
  const goTo = useCallback((target: (i: number) => number) => {
    if (leaveTimer.current) return;
    setLeaving(true);
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      setPeriodIdx(target);
      setTitleDone(false);
      setLeaving(false);
    }, EXIT_MS);
  }, []);
  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const next = useCallback(() => {
    goTo((i) => (i + 1) % Math.max(periods.length, 1));
  }, [goTo, periods.length]);

  useEffect(() => {
    if (top || paused) return;
    const t = setTimeout(next, EMPTY_HOLD_MS);
    return () => clearTimeout(t);
  }, [top, paused, next]);

  return (
    <div className="relative h-lvh w-full overflow-hidden bg-black text-white">
      {top?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={top.imageUrl}
          src={top.imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-25 blur-2xl scale-110 animate-[bgIn_1.4s_ease-out]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

      <div className="relative z-10 flex h-full flex-col">

        {!top ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-white/60">
            No stories found for {period?.label.toLowerCase() ?? "this period"}.
          </div>
        ) : (
          <main className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6 px-4 pt-6 pb-6 md:px-8 md:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1 lg:gap-10 lg:px-16 lg:pb-10 xl:gap-14 xl:px-24">
            {/* The headline card stays put while the body types out beside it. */}
            <section key={top.url} className="flex min-h-0 flex-col justify-center gap-4">
              <div
                className="relative aspect-video max-h-[22vh] w-full overflow-hidden rounded-sm bg-neutral-900 shadow-2xl ring-1 ring-white/10 sm:max-h-none"
                style={stagger(leaving, { name: "imageReveal", delay: 0, duration: 1 }, { name: "imageOut", delay: 0.25 })}
              >
                {top.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={top.imageUrl} alt="" className="h-full w-full object-cover animate-[kenburns_30s_ease-in-out_infinite_alternate]" />
                )}
              </div>
              {/* Square logo beside the headline. The square is the same size for
                  every publication; the logo is fitted inside it. */}
              <div className="flex items-center gap-4">
                {top.brandLogo && (
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm bg-white p-2 md:h-24 md:w-24"
                    style={stagger(leaving, { name: "popIn", delay: 0.35 }, { name: "exitUp", delay: 0.15 })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={top.brandLogo} alt={top.brandName} onError={fallBackToOriginalLogo} className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                <div className="min-w-0" style={stagger(leaving, { name: "riseIn", delay: 0.5 }, { name: "exitUp", delay: 0.1 })}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/60 md:text-sm">
                    {top.brandName}
                  </p>
                  <h1 className="text-xl font-bold leading-tight md:text-2xl xl:text-3xl">
                    <TypedTitle key={top.url} text={top.title} paused={paused || leaving} onDone={markTitleDone} />
                  </h1>
                </div>
              </div>
              <div
                className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-white/70 md:mt-4 md:gap-x-7 md:text-xl"
                style={stagger(leaving, { name: "riseIn", delay: 0.7 }, { name: "exitUp", delay: 0.05 })}
              >
                {top.author && <span>By <span className="font-semibold text-white">{top.author}</span></span>}
                {formatDate(top.publishedAt) && <span>{formatDate(top.publishedAt)}</span>}
                <ViewCount views={top.views} className="font-semibold text-white" />
                <span
                  className="ml-auto whitespace-nowrap rounded-sm px-3 py-1 text-sm font-bold uppercase tracking-wider text-white md:text-base"
                  style={{
                    backgroundColor: BRAND_RED,
                    ...stagger(leaving, { name: "slideInRight", delay: 0.9 }, { name: "exitUp", delay: 0 }),
                  }}
                >
                  #1 {PERIOD_TAGS[period.key] ?? period.label}
                </span>
              </div>
            </section>

            <div className={`grid min-h-0 transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
              <TypedCredits
                key={`${period.key}:${top.url}`}
                story={top}
                upNext={upNext}
                paused={paused || leaving || !titleDone}
                onDone={next}
              />
            </div>
          </main>
        )}
      </div>

      <DashboardControls>
        {periods.map((p, i) => (
          <button
            key={p.key}
            onClick={() => i !== periodIdx && goTo(() => i)}
            className={`rounded-lg px-5 py-3 text-lg ${
              i === periodIdx ? "bg-white text-black" : "bg-black/40 text-white hover:bg-black/60"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPaused((v) => !v)}
          className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60"
        >
          {paused ? "▶ Play" : "❚❚ Pause"}
        </button>
      </DashboardControls>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes kenburns { from { transform: scale(1); } to { transform: scale(1.1); } }
        @keyframes caret { 50% { opacity: 0; } }
        @keyframes bgIn { from { opacity: 0; } to { opacity: 0.25; } }
        @keyframes imageReveal { from { opacity: 0; clip-path: inset(0 0 100% 0); transform: scale(1.04); } to { opacity: 1; clip-path: inset(0); transform: none; } }
        @keyframes imageOut { to { opacity: 0; transform: scale(0.96); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: none; } }
        @keyframes riseIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
        @keyframes exitUp { to { opacity: 0; transform: translateY(-14px); } }
        @keyframes tagIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

// Types the headline quickly. The untyped remainder keeps its space (invisibly)
// so the layout doesn't shift while it types.
function TypedTitle({ text, paused, onDone }: { text: string; paused: boolean; onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (paused) return;
    if (n >= text.length) {
      const t = setTimeout(onDone, BODY_START_DELAY_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n + 1), n === 0 ? TITLE_START_MS : TITLE_TICK_MS);
    return () => clearTimeout(t);
  }, [n, text.length, paused, onDone]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && (
        <span
          className="inline-block h-[0.9em] w-[0.45ch] translate-y-[0.1em] animate-[caret_1s_steps(1)_infinite]"
          style={{ backgroundColor: BRAND_RED }}
        />
      )}
      <span className="invisible">{text.slice(n)}</span>
    </>
  );
}

// Types the story body out character by character, scrolling up as it fills
// the panel, then holds before handing over to the next period.
function TypedCredits({
  story,
  upNext,
  paused,
  onDone,
}: {
  story: Story;
  upNext: { label: string; story: Story } | null;
  paused: boolean;
  onDone: () => void;
}) {
  const total = story.body.reduce((n, p) => n + p.length, 0);
  const pauses = useMemo(() => readingPauses(story.body), [story.body]);
  const [typed, setTyped] = useState(0);
  // Vertical offset of the text: centred while it fits, bottom-aligned after.
  const [offset, setOffset] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const done = typed >= total;
  const showUpNext = !!upNext && total > 0 && typed / total >= UP_NEXT_AT;

  useEffect(() => {
    if (paused) return;
    if (done) {
      const t = setTimeout(onDone, HOLD_AFTER_TYPING_MS);
      return () => clearTimeout(t);
    }
    // A tick never types past a pause point, so every beat lands exactly.
    let stop = total;
    for (const p of pauses.keys()) if (p > typed && p < stop) stop = p;
    const delay = typed > 0 ? (pauses.get(typed) ?? TICK_MS) : TICK_MS;
    const t = setTimeout(() => setTyped(Math.min(stop, typed + CHARS_PER_TICK)), delay);
    return () => clearTimeout(t);
  }, [typed, done, total, paused, onDone, pauses]);

  // Text grows from the centre until it fills the panel; from then on the
  // newest line stays at the bottom and older lines scroll off the top.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const free = viewport.clientHeight - content.scrollHeight;
    setOffset(free >= 0 ? free / 2 : free);
    setOverflowing(free < 0);
  }, [typed, done]);

  const paragraphs = story.body.map((para, i) => {
    const start = story.body.slice(0, i).reduce((n, p) => n + p.length, 0);
    const remaining = typed - start;
    return {
      shown: para.slice(0, Math.max(0, remaining)),
      active: remaining > 0 && remaining < para.length,
    };
  });
  const lastShown = paragraphs.reduce((idx, p, i) => (p.shown ? i : idx), 0);

  return (
    <section className="flex min-h-0 flex-col">
      <div
        ref={viewportRef}
        // Fade the top edge only once lines are scrolling off it.
        className={`relative min-h-0 flex-1 overflow-hidden ${
          overflowing ? "[mask-image:linear-gradient(to_bottom,transparent,black_15%)]" : ""
        }`}
      >
        <div
          ref={contentRef}
          className="max-w-3xl py-2 transition-transform duration-500 ease-out"
          style={{ transform: `translateY(${offset}px)` }}
        >
          <div className="space-y-8 text-xl leading-[1.75] text-white/90 md:space-y-10 md:text-2xl">
            {paragraphs.map((p, i) =>
              p.shown || i === 0 ? (
                <p key={i} className={i === 0 ? "font-semibold text-white" : undefined}>
                  {p.shown}
                  {/* Long articles end on an ellipsis: there is more on the site. */}
                  {done && story.truncated && i === story.body.length - 1 && " …"}
                  {/* No caret until the body has actually started typing. */}
                  {typed > 0 && (p.active || (!done && i === lastShown) || (done && i === story.body.length - 1)) && (
                    <span
                      className="ml-0.5 inline-block h-[1.1em] w-[0.5ch] translate-y-[0.15em] animate-[caret_1s_steps(1)_infinite]"
                      style={{ backgroundColor: BRAND_RED }}
                    />
                  )}
                </p>
              ) : null,
            )}
          </div>

          {/* Article tags pop in one after another once the body is complete. */}
          {done && (story.tags?.length ?? 0) > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {story.tags!.map((tag, i) => (
                <li
                  key={tag}
                  className="rounded-sm bg-white/15 px-4 py-1.5 text-base text-white animate-[tagIn_0.5s_ease-out_both] md:text-lg"
                  style={{ animationDelay: `${0.2 + i * 0.15}s` }}
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {done && (
            <p className="mt-4 text-sm text-white/50 animate-[fadeIn_0.8s_ease-out]">
              {story.truncated ? "View full story on" : "View more stories on"} {story.brandName}
            </p>
          )}
        </div>
      </div>

      {/* Up next sits in its own fixed slot, always reserved, so it never moves
          and the text never jumps when it appears. */}
      {upNext && (
        <div
          className={`mt-6 flex h-20 w-full max-w-3xl shrink-0 items-center gap-4 border-t border-white/15 pt-4 transition-opacity duration-700 ${
            showUpNext ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!showUpNext}
        >
          {upNext.story.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={upNext.story.imageUrl} alt="" className="h-14 w-24 shrink-0 rounded-md object-cover opacity-80" />
          )}
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              Up next · #1 {upNext.label}
              {/* Same fixed box for every publication, so the logo never changes size. */}
              {upNext.story.brandLogo && (
                <span className="flex h-7 w-20 shrink-0 items-center justify-center rounded-sm bg-white px-1.5 py-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={upNext.story.brandLogo} alt={upNext.story.brandName} onError={fallBackToOriginalLogo} className="max-h-full max-w-full object-contain" />
                </span>
              )}
            </p>
            <p className="line-clamp-2 text-base font-semibold leading-snug text-white/80">{upNext.story.title}</p>
          </div>
        </div>
      )}
    </section>
  );
}
