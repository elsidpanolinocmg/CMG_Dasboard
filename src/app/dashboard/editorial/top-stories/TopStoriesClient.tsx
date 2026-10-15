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
// Exits speed up as they leave; entrances (EASE_OUT) slow as they settle.
const EASE_IN = "cubic-bezier(0.64, 0, 0.78, 0)";
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

// Period buttons in the controls.
const PERIOD_BUTTONS: Record<string, string> = {
  daily: "Day",
  weekly: "Week",
  monthly: "Month",
};

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

type Pos = { period: number; story: number };

// Next story in the rotation: down the current period's ranking, then on to
// the next period's #1.
function advance(periods: PeriodStories[], { period, story }: Pos): Pos {
  if (story + 1 < (periods[period]?.stories.length ?? 0)) return { period, story: story + 1 };
  return { period: (period + 1) % Math.max(periods.length, 1), story: 0 };
}

// The period's top stories in rank order, all on screen. The cards stay put;
// the playing story's card is highlighted.
function RankingCarousel({
  stories,
  current,
  label,
  leaving,
}: {
  stories: Story[];
  current: number;
  label: string;
  leaving: boolean;
}) {
  const n = stories.length;
  if (n < 2) return null;
  return (
    <div style={stagger(leaving, { name: "riseIn", delay: 1.1 }, { name: "exitUp", delay: 0 })}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/50 md:text-sm">
        Top {n} · {label}
      </p>
      <ol className="grid gap-3" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stories.map((s, i) => (
          <li key={s.url}>
            <RankCardContent story={s} rank={i + 1} playing={i === current} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// "Most read stories" list (list layout): one row per story with its logo,
// rank, headline and views. The row on screen is highlighted.
function MostReadList({
  stories,
  current,
  label,
  leaving,
}: {
  stories: Story[];
  current: number;
  label: string;
  leaving: boolean;
}) {
  return (
    <section
      className="flex min-h-0 flex-col"
      style={stagger(leaving, { name: "riseIn", delay: 0.2 }, { name: "exitUp", delay: 0 })}
    >
      <header className="border-b border-white/25 pb-4">
        <h2 className="text-2xl font-bold uppercase tracking-[0.15em] md:text-3xl">Most read stories</h2>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] md:text-base" style={{ color: BRAND_RED }}>
          {label}
        </p>
      </header>
      <ol className="flex min-h-0 flex-1 flex-col">
        {stories.map((s, i) => {
          const active = i === current;
          return (
            <li
              key={s.url}
              className={`flex min-h-0 flex-1 items-center gap-4 border-b border-white/15 px-3 transition-colors duration-700 md:gap-5 ${
                active ? "bg-white/10 text-white" : "text-white/55"
              }`}
              style={{ boxShadow: active ? `inset 4px 0 0 ${BRAND_RED}` : undefined }}
            >
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm bg-white p-1.5 md:h-20 md:w-20">
                {s.brandLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.brandLogo} alt={s.brandName} onError={fallBackToOriginalLogo} className="max-h-full max-w-full object-contain" />
                )}
              </span>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold transition-colors duration-700 md:h-12 md:w-12 md:text-xl ${
                  active ? "border-transparent text-white" : "border-white/40"
                }`}
                style={{ backgroundColor: active ? BRAND_RED : undefined }}
              >
                {i + 1}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 text-lg font-semibold leading-snug md:text-xl">{s.title}</span>
              <ViewCount views={s.views} className="shrink-0 text-base tabular-nums md:text-lg" />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RankCardContent({ story: s, rank, playing }: { story: Story; rank: number; playing: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-sm bg-white/5 ring-1 transition duration-500 ${
        playing ? "opacity-100" : "opacity-55 ring-white/10"
      }`}
      style={playing ? { boxShadow: `0 0 0 2px ${BRAND_RED}` } : undefined}
    >
      <div className="relative aspect-video bg-neutral-900">
        {s.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span
          className="absolute left-0 top-0 rounded-br-sm px-2 py-0.5 text-sm font-bold text-white"
          style={{ backgroundColor: playing ? BRAND_RED : "rgba(0,0,0,0.7)" }}
        >
          #{rank}
        </span>
        {s.brandLogo && (
          <span className="absolute bottom-1 left-1 flex h-6 w-14 items-center justify-center rounded-sm bg-white px-1 py-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.brandLogo} alt={s.brandName} onError={fallBackToOriginalLogo} className="max-h-full max-w-full object-contain" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        <p className="line-clamp-2 min-h-[2.5em] text-sm font-semibold leading-tight text-white">{s.title}</p>
        <ViewCount views={s.views} className="text-xs text-white/60" />
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  // Month first, e.g. "Oct 14, 2026".
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type TopStoriesLayout = "carousel" | "list";

export default function TopStoriesClient({
  periods,
  layout: initialLayout = "list",
}: {
  periods: PeriodStories[];
  layout?: TopStoriesLayout;
}) {
  const [layout, setLayout] = useState<TopStoriesLayout>(initialLayout);
  // Switch layout in place, keeping ?layout= in the address so a reload keeps it.
  const toggleLayout = () => {
    const nextLayout = layout === "list" ? "carousel" : "list";
    setLayout(nextLayout);
    const url = new URL(window.location.href);
    if (nextLayout === "carousel") url.searchParams.set("layout", "carousel");
    else url.searchParams.delete("layout");
    window.history.replaceState(null, "", url);
  };
  // Where the rotation is: which period, and which of its top stories.
  const [pos, setPos] = useState<Pos>({ period: 0, story: 0 });
  const periodIdx = pos.period;
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // True while leaving for a different period (the ranking list leaves too).
  const [leavingPeriod, setLeavingPeriod] = useState(false);
  const [titleDone, setTitleDone] = useState(false);
  const markTitleDone = useCallback(() => setTitleDone(true), []);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const period = periods[periodIdx];
  const top = period?.stories[pos.story];
  const nextPos = advance(periods, pos);
  const upNextPeriod = periods[nextPos.period];
  const upNextStory = upNextPeriod?.stories[nextPos.story];
  const upNext =
    upNextStory && upNextStory !== top
      ? { label: `#${nextPos.story + 1} ${PERIOD_TAGS[upNextPeriod.key] ?? upNextPeriod.label}`, story: upNextStory }
      : null;

  // Play the exit, then switch story (which plays the next entrance).
  const goTo = useCallback((target: Pos) => {
    if (leaveTimer.current) return;
    setLeaving(true);
    setLeavingPeriod(target.period !== periodIdx);
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      setPos(target);
      setTitleDone(false);
      setLeaving(false);
      setLeavingPeriod(false);
    }, EXIT_MS);
  }, [periodIdx]);
  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const next = useCallback(() => {
    goTo(advance(periods, pos));
  }, [goTo, periods, pos]);

  useEffect(() => {
    if (top || paused) return;
    const t = setTimeout(next, EMPTY_HOLD_MS);
    return () => clearTimeout(t);
  }, [top, paused, next]);

  // The headline card stays put while the body types out beside it.
  const headline = top && (
    <section key={top.url} className="flex min-h-0 flex-col gap-4">
      <div
        className={`relative aspect-video max-h-[22vh] w-full overflow-hidden rounded-sm bg-neutral-900 shadow-2xl ring-1 ring-white/10 ${
          layout === "list" ? "sm:max-h-[46vh]" : "sm:max-h-none"
        }`}
        // The old image sinks away and the new one rises in: one
        // continuous motion that carries on from "Up next" moving up.
        style={{
          animation: leaving
            ? `imageSink 0.55s ${EASE_IN} 0.1s both`
            : `imageRise 0.9s ${EASE_OUT} both`,
        }}
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
          #{pos.story + 1} {PERIOD_TAGS[period.key] ?? period.label}
        </span>
      </div>
    </section>
  );
  const carousel = top && (
    <RankingCarousel
      key={period.key}
      stories={period.stories}
      current={pos.story}
      label={PERIOD_TAGS[period.key] ?? period.label}
      leaving={leavingPeriod}
    />
  );
  // The body and "Up next" drift up and away; the next story's panel rises in
  // from below, continuing the same direction.
  const body = top && (
    <div
      key={`${period.key}:${top.url}`}
      className={`grid min-h-0 ${layout === "list" ? "flex-1" : ""}`}
      style={{
        animation: leaving
          ? `panelUp 0.55s ${EASE_IN} both`
          : `panelRise 0.9s ${EASE_OUT} 0.15s both`,
      }}
    >
      <TypedCredits
        key={`${period.key}:${top.url}`}
        story={top}
        // The list layout shows what is next in the list itself.
        upNext={layout === "list" ? null : upNext}
        paused={paused || leaving || !titleDone}
        onDone={next}
      />
    </div>
  );

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
          layout === "list" ? (
            // List layout: the article (image, headline, typed body) on the
            // left; the period's most-read list on the right.
            <main className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6 px-4 pt-6 pb-6 md:px-8 md:pt-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] lg:grid-rows-1 lg:gap-10 lg:px-16 lg:pb-10 xl:gap-14 xl:px-24">
              <div className="flex min-h-0 flex-col gap-8">
                {headline}
                {body}
              </div>
              <MostReadList
                key={period.key}
                stories={period.stories}
                current={pos.story}
                label={PERIOD_TAGS[period.key] ?? period.label}
                leaving={leavingPeriod}
              />
            </main>
          ) : (
            <main className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-6 px-4 pt-6 pb-6 md:px-8 md:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1 lg:gap-10 lg:px-16 lg:pb-10 xl:gap-14 xl:px-24">
              <div className="flex min-h-0 flex-col justify-center gap-8">
                {headline}
                {carousel}
              </div>
              {body}
            </main>
          )
        )}
      </div>

      <DashboardControls>
        {periods.map((p, i) => (
          <button
            key={p.key}
            onClick={() => i !== periodIdx && goTo({ period: i, story: 0 })}
            className={`rounded-lg px-5 py-3 text-lg ${
              i === periodIdx ? "bg-white text-black" : "bg-black/40 text-white hover:bg-black/60"
            }`}
          >
            {PERIOD_BUTTONS[p.key] ?? p.label}
          </button>
        ))}
        {/* Layout switch: one button showing the layout it switches to. */}
        <button
          onClick={toggleLayout}
          aria-label={layout === "list" ? "Switch to carousel layout" : "Switch to list layout"}
          title={layout === "list" ? "Switch to carousel layout" : "Switch to list layout"}
          className="rounded-lg bg-black/40 px-4 py-3 text-white hover:bg-black/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
            {layout === "list" ? (
              <>
                <rect x="3" y="4" width="18" height="10" rx="1" />
                <path d="M3 18h4M10 18h4M17 18h4" />
              </>
            ) : (
              <>
                <path d="M9 6h12M9 12h12M9 18h12" />
                <path d="M4 6h.01M4 12h.01M4 18h.01" />
              </>
            )}
          </svg>
        </button>
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
        @keyframes imageSink { to { opacity: 0; transform: translateY(48px) scale(0.97); } }
        @keyframes imageRise { from { opacity: 0; transform: translateY(64px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes panelUp { to { opacity: 0; transform: translateY(-48px); } }
        @keyframes panelRise { from { opacity: 0; transform: translateY(48px); } to { opacity: 1; transform: none; } }
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
              Up next · {upNext.label}
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
