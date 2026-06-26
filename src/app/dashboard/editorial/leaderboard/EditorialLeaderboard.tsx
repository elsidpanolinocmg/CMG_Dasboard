"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardControls from "@/components/DashboardControls";
import { useSwipeNav } from "@/lib/hooks/useSwipeNav";
import { RANGE_OPTIONS, SECTION_OPTIONS, type RangeKey } from "./range";

export type ArticleRow = {
  brand: string;
  brandName: string;
  domain: string;
  nid: number;
  title: string;
  alias: string;
  authorName: string;
  views: number;
};

export type AuthorRow = {
  authorName: string;
  brands: string[];
  articles: ArticleRow[];
  totalViews: number;
};

interface Props {
  authors: AuthorRow[];
  rangeKey: RangeKey;
  rangeLabel: string;
  sectionSlug: string;
  brandCount: number;
}

const BRAND_NAVY = "#003660";
const BRAND_RED = "#BD202E";
const ALT_ROW_BG = "#f4f7fb";
const ROW_BORDER = "#dbe3ec";
const CHIP_BG = "#e6eef5";

const PAGE_OPTIONS = [3, 4, 5, 6];
const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

// 1% of the REAL visible viewport height (measured via visualViewport and set on
// <html> as --lvh by the effect below). Falls back to 1dvh before JS / on SSR.
// Safari's dvh reports the toolbar-hidden (taller) height, so dvh-sized rows
// overran the visible area and clipped under the tab bar; --lvh is toolbar-aware.
const LVH = "var(--lvh, 1dvh)";

// Auto-fit the number of journalist rows on phones so the table fits the visible
// viewport (no scroll/clip). Mirrors the row model — rows are `78vh / (count + 1)`
// tall with a 60px floor — so the count is capped where a row would drop below that
// floor. Desktop/TV keep the fixed 6 rows.
function computePageSize(): number {
  if (typeof window === "undefined") return 6;
  const isPhone = window.innerWidth < 768 || window.innerHeight < 500;
  if (!isPhone) return 6;
  // Cap at 6 — the largest selectable option (PAGE_OPTIONS). Going higher set
  // pageSize to a value with no matching <option>, so the select fell back to
  // showing "Show 3" while the table rendered the larger row count.
  return Math.max(3, Math.min(6, Math.floor((window.innerHeight * 0.78) / 60) - 1));
}

function firstName(raw: string): string {
  if (!raw) return raw;
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const first = base.split(/[\s._-]+/).filter(Boolean)[0] ?? raw;
  if (raw.includes("@")) return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return first;
}

function rankColor(rank: number): string {
  if (rank === 1) return "#b8860b";
  if (rank === 2) return "#71717a";
  if (rank === 3) return "#a0522d";
  return "#1f2937";
}

function rankShadow(rank: number): string {
  if (rank === 1) return "0 0 14px rgba(212, 168, 83, 0.45)";
  if (rank === 2) return "0 0 12px rgba(160, 160, 170, 0.4)";
  if (rank === 3) return "0 0 12px rgba(160, 100, 60, 0.4)";
  return "none";
}

export default function EditorialLeaderboard({
  authors,
  rangeKey,
  rangeLabel,
  sectionSlug,
  brandCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Fixed initial value so SSR and the first client render match (reading the
  // viewport in useState would cause a hydration mismatch — server has no
  // window). The real viewport-fit value is applied in the effect below, right
  // after mount.
  const [pageSize, setPageSize] = useState<number>(6);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(60_000);
  // Tap-to-reveal popover listing the brand tags that don't fit under a name.
  const [tagPopover, setTagPopover] = useState<string[] | null>(null);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // On phones, pick a row count that fits the visible viewport height so the
  // table never scrolls or clips (rows hit a 60px floor below ~that height).
  // Desktop/TV keep the fixed 6. Applied on mount + recomputed on rotate/resize.
  useEffect(() => {
    const apply = () => {
      const next = computePageSize();
      setPageSize((cur) => (cur === next ? cur : next));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Whenever the page size changes (auto-fit on rotate, or a manual pick),
  // jump back to the first page so we never land on an out-of-range page.
  useEffect(() => {
    setPageIndex(0);
  }, [pageSize]);

  // This is a fixed full-screen dashboard — nothing should scroll. The root is
  // h-[100dvh] overflow-hidden, but the document itself can still overscroll on
  // mobile Chrome (you drag, the URL bar hides, then it snaps back). Lock the
  // body/html scroll while mounted, and restore on unmount so other pages keep
  // their normal scrolling.
  useEffect(() => {
    const html = document.documentElement;
    const { overflow: prevHtml } = html.style;
    const { overflow: prevBody, overscrollBehavior: prevOverscroll } =
      document.body.style;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  // Size everything to the REAL visible viewport: visualViewport.height is the
  // toolbar/tab-bar-aware height in Safari AND Chrome (unlike dvh/innerHeight,
  // which can report the toolbar-hidden taller height). Expose it as --lvh (1% of
  // it) for the dvh-replacement calcs. Remove on unmount so other pages are clean.
  useEffect(() => {
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      // --lvh = 1% (for the inline calc row sizing); --vvh = full height (for the
      // .h-lvh utility on the page wrapper). See ViewportFit for why .h-lvh needs
      // its own plain-var value rather than a calc-multiply.
      document.documentElement.style.setProperty("--lvh", `${h / 100}px`);
      document.documentElement.style.setProperty("--vvh", `${h}px`);
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const t = setTimeout(apply, 300);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      document.documentElement.style.removeProperty("--lvh");
      document.documentElement.style.removeProperty("--vvh");
    };
  }, []);

  // The full table renders BOTH on a landscape phone and on desktop/TV, so the
  // per-page-size tweaks below are gated to this flag to leave desktop/TV alone.
  const [isLandscapePhone, setIsLandscapePhone] = useState(false);
  useEffect(() => {
    // Detect on short height (the cause of the clipping) so it catches phones
    // whose landscape width exceeds 950px; desktop/TV/laptops are taller.
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 600px)");
    const apply = () => setIsLandscapePhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // Tablets (iPads) render the desktop table. On "Show All" they're too short to
  // fit every journalist at the 60px row floor, so the bottom + Total clip. Detect
  // tablets (touch + ≥768px, excludes phones/mouse desktop/TV) to apply the same
  // shrink-to-fit treatment landscape phones use, but only on Show All.
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse) and (min-width: 768px)");
    const apply = () => setIsTablet(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const totalPages = Math.max(1, Math.ceil(authors.length / pageSize));
  const displayed = authors.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const padded: (AuthorRow | null)[] = [...displayed];
  while (padded.length < pageSize) padded.push(null);

  const grandTotal = useMemo(
    () => authors.reduce((s, a) => s + a.totalViews, 0),
    [authors],
  );

  const handlePageSize = (n: number) => {
    setPageSize(n);
    setPageIndex(0);
  };

  const handleRangeChange = (next: RangeKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    startTransition(() => router.push(`?${params.toString()}`));
  };

  const handleSectionChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("section", next);
    else params.delete("section");
    startTransition(() => router.push(`?${params.toString()}`));
  };

  const sectionLabel =
    SECTION_OPTIONS.find((o) => o.value === sectionSlug)?.label ?? "All sections";

  useEffect(() => {
    if (rotationTimer.current) clearInterval(rotationTimer.current);
    if (rotationInterval <= 0 || totalPages <= 1) return;
    rotationTimer.current = setInterval(
      () => setPageIndex((i) => (i + 1) % totalPages),
      rotationInterval,
    );
    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current);
    };
  }, [rotationInterval, totalPages]);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  const count = pageSize || 1;
  const eff = Math.min(count + 1, 12);
  const rowHeightVh = 78 / (count + 1);
  // "Show All" selected (its option value is authors.length). On a tablet this is
  // the case that overflows the 60px floor, so treat tablet+All like a landscape
  // phone (shrink rows + trim detail) so everything fits without clipping. Desktop/
  // TV (mouse) and tablet non-All keep their normal layout.
  const isAllMode = pageSize >= Math.max(authors.length, 1);
  const compact = isLandscapePhone || (isTablet && isAllMode);
  // On a landscape phone, give the total row a slim fixed slice so the journalist
  // rows (which carry the stories) get more height and stop clipping.
  const totalRowVh = isLandscapePhone ? 9 : rowHeightVh;
  const journalistRowVh = isLandscapePhone ? (78 - totalRowVh) / count : rowHeightVh;
  // Adaptive detail: fewer top stories as rows get shorter (more journalists),
  // so each row's line count tracks the height available to it.
  // Compact (landscape phone or tablet All) shrinks detail; desktop/TV keeps 3.
  const storiesToShow = compact
    ? (count <= 3 ? 3 : count <= 5 ? 2 : count <= 9 ? 1 : 0)
    : 3;
  // Cap how many brand tags render under a name (compact only — desktop shows them
  // all). Show 3 → up to 8 small tags; 4 → 4; 5 → 3; 6/7 → 1 inline beside the
  // article count; Show All → 0. The rest fold into a tappable "+N".
  const maxChips = compact
    ? (count <= 3 ? 4 : count === 4 ? 3 : count === 5 ? 2 : 0)
    : 999;
  // Show 6/7/All compact: put the tag(s) beside the article count (inline) instead
  // of on their own line under the name.
  const tagsInline = compact && maxChips <= 1;
  // Per-row line budgets — desktop puts the stories in their own cell (vs the
  // name+chips cell); mobile stacks name/chips + stories in one cell. Fonts are
  // capped at a fraction of the budget so content fits the row at any page size.
  const desktopLines = Math.max(2, storiesToShow);
  const dLineVh = journalistRowVh / desktopLines;
  // Portrait (compact) table: it's the only block on screen, so its rows stretch
  // to fill ~the whole viewport (their set height is only a hint). Give Show 3/4
  // extra stories and base the content cap on the *stretched* row height (~92dvh
  // split across the rows) so Show 3-6 stop clipping. Landscape uses the full
  // table above and is unaffected by these (all gated to !isLandscapePhone).
  const mobileStories = !isLandscapePhone
    ? (count <= 3 ? 5 : count === 4 ? 4 : count <= 6 ? 3 : 2)
    : storiesToShow;
  const mobileRowVh = 92 / (count + 1);
  const mobileRowMaxH = `calc(${mobileRowVh} * ${LVH} - 0.4rem)`;
  const mobileLines = 1 + mobileStories;
  const mLineVh = mobileRowVh / mobileLines;
  // Cap each row's content to its slot (minus cell padding) and clip the
  // overflow, so a journalist with many brand chips or tall stories can't grow
  // the row past its height and shove the bottom (total) row off-screen.
  const rowInnerMaxH = `calc(${journalistRowVh} * ${LVH} - ${isLandscapePhone ? "0.35rem" : "1rem"})`;
  // Desktop/TV: the table is `h-full`, so the browser stretches each row taller
  // than its `journalistRowVh` hint (which is based on 78dvh) to fill 100dvh. A
  // maxHeight cap built from that smaller hint therefore clips content that
  // actually fits the rendered row — and the clip gets worse when the window
  // isn't fullscreen (shorter viewport → fewer px per dvh, while the vw-driven
  // fonts don't shrink as fast). So on desktop we clip to the *real* cell: an
  // absolutely-positioned inner div fills the rendered row exactly. Landscape
  // phone keeps the tuned dvh cap (its rows don't stretch the same way).
  const clipToRenderedRow = !isLandscapePhone;
  const cellInnerClass = clipToRenderedRow
    ? "absolute inset-0 px-3 py-2 flex flex-col justify-center gap-1 overflow-hidden"
    : "flex flex-col gap-1 overflow-hidden";
  const cellInnerStyle = clipToRenderedRow ? undefined : { maxHeight: rowInnerMaxH };
  // On a landscape phone, cap the name/story/chip fonts much smaller (and allow
  // a lower floor) so tags + stories stay compact and never clip — even on the
  // taller rows of Show 3. Desktop/TV keep their original ceilings.
  const nameMax = isLandscapePhone ? "1.15rem" : "3.2rem";
  const storyMax = isLandscapePhone ? "0.88rem" : "1.7rem";
  const chipMax = isLandscapePhone ? "0.72rem" : "1.3rem";
  const fontSize = `clamp(0.8rem, min(calc(0.6vw + ${7 / eff}vw), calc(${dLineVh * 0.8} * ${LVH})), ${nameMax})`;
  const headerSize = `clamp(0.7rem, min(calc(0.4vw + ${4.5 / eff}vw), calc(${rowHeightVh * 0.2} * ${LVH})), 1.6rem)`;
  const storySize = `clamp(0.68rem, min(calc(0.45vw + ${5.5 / eff}vw), calc(${dLineVh * 0.7} * ${LVH})), ${storyMax})`;
  const totalBigSize = `clamp(1.2rem, calc(0.7vw + ${8 / eff}vw), 3.2rem)`;
  const totalSummarySize = `clamp(0.65rem, calc(0.3vw + ${3 / eff}vw), 1.1rem)`;
  const chipSize = `clamp(0.62rem, min(calc(0.35vw + ${3.5 / eff}vw), calc(${dLineVh * 0.55} * ${LVH})), ${chipMax})`;
  // Inline tags (Show 6/7/All) sit beside the article count on one short line, so
  // make them extra small to fit there and stay visible (rather than wrapping
  // under the name where the short row clips them).
  const chipFont = tagsInline ? "0.58rem" : chipSize;
  // Shrink the per-story brand chip only on the short-row sizes (Show 6+), where
  // it was clipping; Show 3/4/5 keep the normal 0.7em chip.
  const smallStoryChip = isLandscapePhone && count >= 6;

  const swipe = useSwipeNav({
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    enabled: totalPages > 1,
  });

  return (
    <div
      className="flex flex-col px-0 md:px-6 overflow-hidden"
      // `safe center` centers the content when it fits, but falls back to
      // top-aligned when it's taller than the viewport (Chrome's shorter
      // landscape dvh) — so the header at the top edge is never clipped.
      style={{ height: `calc(100 * ${LVH})`, backgroundColor: "#ffffff", justifyContent: "safe center" }}
      {...swipe}
    >
      {isPending && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(2px)" }}
        >
          <div
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-lg shadow-lg"
            style={{ background: "#ffffff", border: `1px solid ${ROW_BORDER}` }}
          >
            <div
              className="w-10 h-10 rounded-full animate-spin"
              style={{ border: `3px solid ${ROW_BORDER}`, borderTopColor: BRAND_RED }}
            />
            <div
              className="text-sm uppercase tracking-widest font-semibold"
              style={{ color: BRAND_NAVY }}
            >
              Loading…
            </div>
          </div>
        </div>
      )}

      <div className="hidden md:flex landscape-show flex-col flex-1 min-h-0">
        <table className="lb-table w-full border-collapse table-fixed h-full" style={{ fontSize }}>
          <thead>
            <tr
              className="text-left font-semibold uppercase"
              style={{
                fontSize: headerSize,
                backgroundColor: BRAND_NAVY,
                color: "#ffffff",
                letterSpacing: "0.14em",
              }}
            >
              <th className="px-4 py-3 w-[8%] text-center">Rank</th>
              <th className="px-3 py-3 w-[26%]">Journalist</th>
              <th className="px-3 py-3 w-[50%]">Top Stories</th>
              <th className="px-4 py-3 w-[16%] text-right">Total Views</th>
            </tr>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: 0,
                  height: "3px",
                  background: `linear-gradient(90deg, ${BRAND_RED}, ${BRAND_NAVY} 60%, transparent)`,
                }}
              />
            </tr>
          </thead>
          <tbody>
            {padded.map((a, idx) => {
              const rank = pageIndex * pageSize + idx + 1;
              const accent = rankColor(rank);
              const shadow = rankShadow(rank);
              const stories = a ? a.articles.slice(0, storiesToShow) : [];
              return (
                <tr
                  key={a ? a.authorName : `empty-${idx}`}
                  style={{
                    height: `calc(${journalistRowVh} * ${LVH})`,
                    minHeight: compact ? "0px" : "60px",
                    backgroundColor: idx % 2 === 0 ? "#ffffff" : ALT_ROW_BG,
                    borderBottom: `1px solid ${ROW_BORDER}`,
                  }}
                >
                  <td
                    className="px-2 py-2 text-center font-mono font-bold align-middle"
                    style={{ color: accent, textShadow: shadow, fontSize: "1.4em" }}
                  >
                    {a ? `#${rank}` : ""}
                  </td>
                  <td className="px-3 py-2 align-middle relative">
                    {a && (() => {
                      const chipsContent = (
                        <>
                          {a.brands.slice(0, maxChips).map((b) => (
                            <span
                              key={b}
                              className="inline-block uppercase font-semibold tracking-wider"
                              style={{
                                fontSize: chipFont,
                                background: CHIP_BG,
                                color: BRAND_NAVY,
                                padding: "1px 8px",
                                borderRadius: "9999px",
                                lineHeight: 1.4,
                                border: `1px solid ${ROW_BORDER}`,
                              }}
                            >
                              {b}
                            </span>
                          ))}
                          {a.brands.length > maxChips && (
                            <button
                              type="button"
                              className="inline-block uppercase font-semibold tracking-wider cursor-pointer"
                              title={a.brands.slice(maxChips).join(", ")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagPopover(a.brands.slice(maxChips));
                              }}
                              style={{
                                fontSize: chipFont,
                                background: "transparent",
                                color: "#6b7280",
                                padding: "1px 6px",
                                borderRadius: "9999px",
                                lineHeight: 1.4,
                                border: `1px dashed ${ROW_BORDER}`,
                              }}
                            >
                              +{a.brands.length - maxChips}
                            </button>
                          )}
                        </>
                      );
                      return (
                        <div className={cellInnerClass} style={cellInnerStyle}>
                          <span
                            className="font-semibold leading-tight uppercase flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                            style={{ color: "#111827", letterSpacing: "0.04em" }}
                            title={a.authorName}
                          >
                            {firstName(a.authorName)}
                            <span
                              className="font-normal normal-case tracking-normal"
                              style={{ color: "#6b7280", fontSize: "0.7em" }}
                            >
                              · {a.articles.length} {a.articles.length === 1 ? "article" : "articles"}
                            </span>
                            {tagsInline && chipsContent}
                          </span>
                          {!tagsInline && (
                            <div className="flex flex-wrap gap-1">{chipsContent}</div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 align-middle relative">
                    {a && (
                      <div className={cellInnerClass} style={cellInnerStyle}>
                        {stories.map((s) => (
                          <div
                            key={`${s.brand}-${s.nid}`}
                            className="flex items-baseline gap-2"
                            style={{ fontSize: storySize, lineHeight: 1.35 }}
                          >
                            <span
                              className="inline-block uppercase font-semibold tracking-wider shrink-0 text-center"
                              style={{
                                background: CHIP_BG,
                                color: BRAND_NAVY,
                                border: `1px solid ${ROW_BORDER}`,
                                padding: smallStoryChip ? "0 4px" : "0 8px",
                                borderRadius: "9999px",
                                minWidth: smallStoryChip ? "2.2em" : "3.5em",
                                fontSize: smallStoryChip ? "0.65em" : "0.7em",
                                lineHeight: smallStoryChip ? 1.1 : undefined,
                              }}
                              title={s.brandName}
                            >
                              {s.brand}
                            </span>
                            <a
                              href={`https://${s.domain}${s.alias}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline truncate"
                              style={{ color: BRAND_NAVY }}
                              title={s.title}
                            >
                              {s.title}
                            </a>
                            <span
                              className="font-mono ml-auto shrink-0"
                              style={{ color: "#6b7280" }}
                            >
                              {s.views.toLocaleString("en-US")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-mono font-bold align-middle"
                    style={{
                      color: a && a.totalViews > 0 ? BRAND_NAVY : "#9ca3af",
                      fontSize: "1.1em",
                    }}
                  >
                    {a ? a.totalViews.toLocaleString("en-US") : ""}
                  </td>
                </tr>
              );
            })}
            <tr
              style={{
                height: `calc(${totalRowVh} * ${LVH})`,
                minHeight: compact ? "0px" : "50px",
                background: `linear-gradient(90deg, #ffffff, ${ALT_ROW_BG})`,
                borderTop: `2px solid ${BRAND_RED}`,
              }}
            >
              <td className="px-2 py-2" />
              <td
                className="px-3 py-2 uppercase font-semibold"
                style={{ color: BRAND_NAVY, letterSpacing: "0.14em", fontSize: totalBigSize }}
              >
                Total
              </td>
              <td className="px-3 py-2" style={{ color: "#6b7280", fontSize: totalSummarySize }}>
                {authors.length} journalist{authors.length === 1 ? "" : "s"} · {rangeLabel}
                {sectionSlug ? ` · ${sectionLabel}` : ""} · {brandCount} Publications
              </td>
              <td
                className="px-4 py-2 text-right font-mono font-bold"
                style={{ color: BRAND_RED, fontSize: totalBigSize }}
              >
                {grandTotal.toLocaleString("en-US")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex md:hidden landscape-hide flex-col flex-1 min-h-0">
        <table
          className="w-full border-collapse table-fixed h-full"
          style={{ fontSize: `clamp(0.7rem, min(calc(0.8vw + ${6 / eff}vw), ${mLineVh * 0.72}vh), 2rem)` }}
        >
          <thead>
            <tr
              className="text-left font-semibold uppercase"
              style={{
                fontSize: `clamp(0.6rem, calc(0.5vw + ${4 / eff}vw), 1.4rem)`,
                backgroundColor: BRAND_NAVY,
                color: "#ffffff",
                letterSpacing: "0.12em",
              }}
            >
              <th className="px-1 py-2 w-[12%] text-center">#</th>
              <th className="px-1 py-2 w-[58%]">Journalist · Top Stories</th>
              <th className="px-1 py-2 pr-3 w-[30%] text-right">Views</th>
            </tr>
            <tr>
              <td
                colSpan={3}
                style={{
                  padding: 0,
                  height: "2px",
                  background: `linear-gradient(90deg, ${BRAND_RED}, ${BRAND_NAVY} 60%, transparent)`,
                }}
              />
            </tr>
          </thead>
          <tbody>
            {padded.map((a, idx) => {
              const rank = pageIndex * pageSize + idx + 1;
              const accent = rankColor(rank);
              const shadow = rankShadow(rank);
              const stories = a ? a.articles.slice(0, mobileStories) : [];
              return (
                <tr
                  key={a ? `m-${a.authorName}` : `m-empty-${idx}`}
                  style={{
                    height: `calc(${rowHeightVh} * ${LVH})`,
                    minHeight: "60px",
                    backgroundColor: idx % 2 === 0 ? "#ffffff" : ALT_ROW_BG,
                    borderBottom: `1px solid ${ROW_BORDER}`,
                  }}
                >
                  <td
                    className="px-1 py-1 text-center font-mono font-bold align-top"
                    style={{ color: accent, textShadow: shadow, fontSize: "1.25em" }}
                  >
                    {a ? `#${rank}` : ""}
                  </td>
                  <td className="px-1 py-1 align-top">
                    {a && (
                      <div className="flex flex-col gap-1 overflow-hidden" style={{ maxHeight: mobileRowMaxH }}>
                        <span
                          className="font-semibold uppercase"
                          style={{ color: "#111827", letterSpacing: "0.04em" }}
                          title={a.authorName}
                        >
                          {firstName(a.authorName)}
                          <span
                            className="font-normal normal-case tracking-normal ml-1"
                            style={{ color: "#6b7280", fontSize: "0.7em" }}
                          >
                            · {a.articles.length} {a.articles.length === 1 ? "article" : "articles"}
                          </span>
                        </span>
                        {a.brands.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {a.brands.slice(0, a.brands.length > 4 ? 4 : a.brands.length).map((b) => (
                              <span
                                key={b}
                                className="uppercase font-semibold tracking-wider"
                                style={{
                                  fontSize: "0.65em",
                                  background: CHIP_BG,
                                  color: BRAND_NAVY,
                                  border: `1px solid ${ROW_BORDER}`,
                                  padding: "1px 6px",
                                  borderRadius: "9999px",
                                }}
                              >
                                {b}
                              </span>
                            ))}
                            {a.brands.length > 4 && (
                              <button
                                type="button"
                                className="uppercase font-semibold tracking-wider cursor-pointer"
                                title={a.brands.slice(4).join(", ")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagPopover(a.brands.slice(4));
                                }}
                                style={{
                                  fontSize: "0.65em",
                                  background: "transparent",
                                  color: "#6b7280",
                                  border: `1px solid ${ROW_BORDER}`,
                                  padding: "1px 6px",
                                  borderRadius: "9999px",
                                }}
                              >
                                +{a.brands.length - 4}
                              </button>
                            )}
                          </div>
                        )}
                        {stories.map((s) => (
                          <div
                            key={`m-${s.brand}-${s.nid}`}
                            className="flex items-baseline gap-1"
                            style={{ fontSize: "0.78em", lineHeight: 1.3 }}
                          >
                            <span
                              className="inline-block uppercase font-semibold tracking-wider shrink-0 text-center"
                              style={{
                                background: CHIP_BG,
                                color: BRAND_NAVY,
                                border: `1px solid ${ROW_BORDER}`,
                                padding: "0 6px",
                                borderRadius: "9999px",
                                minWidth: "3em",
                                fontSize: "0.65em",
                              }}
                              title={s.brandName}
                            >
                              {s.brand}
                            </span>
                            <a
                              href={`https://${s.domain}${s.alias}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline truncate"
                              style={{ color: BRAND_NAVY }}
                              title={s.title}
                            >
                              {s.title}
                            </a>
                            <span
                              className="font-mono ml-auto shrink-0"
                              style={{ color: "#6b7280" }}
                            >
                              {s.views.toLocaleString("en-US")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-1 py-1 pr-3 text-right font-mono font-bold align-top"
                    style={{
                      color: a && a.totalViews > 0 ? BRAND_NAVY : "#9ca3af",
                      fontSize: "1.1em",
                    }}
                  >
                    {a ? a.totalViews.toLocaleString("en-US") : ""}
                  </td>
                </tr>
              );
            })}
            <tr
              style={{
                height: `calc(${totalRowVh} * ${LVH})`,
                minHeight: isLandscapePhone ? "0px" : "44px",
                background: `linear-gradient(90deg, #ffffff, ${ALT_ROW_BG})`,
                borderTop: `2px solid ${BRAND_RED}`,
              }}
            >
              <td className="px-1 py-1" />
              <td
                className="px-1 py-1 uppercase font-semibold"
                style={{ color: BRAND_NAVY, letterSpacing: "0.12em", fontSize: totalBigSize }}
              >
                Total
              </td>
              <td
                className="px-1 py-1 pr-3 text-right font-mono font-bold"
                style={{ color: BRAND_RED, fontSize: totalBigSize }}
              >
                {grandTotal.toLocaleString("en-US")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <DashboardControls>
        <button
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ◀ Prev
        </button>
        <select
          value={pageSize}
          onChange={(e) => handlePageSize(Number(e.target.value))}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Show {n}
            </option>
          ))}
          <option value={Math.max(authors.length, 1)}>Show All ({authors.length})</option>
        </select>
        <span className="text-sm text-white/80">
          {Math.min(pageIndex + 1, totalPages)} / {totalPages}
        </span>
        <button
          onClick={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))}
          disabled={pageIndex >= totalPages - 1}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next ▶
        </button>
        <select
          value={rangeKey}
          onChange={(e) => handleRangeChange(e.target.value as RangeKey)}
          disabled={isPending}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-50 disabled:cursor-wait [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sectionSlug}
          onChange={(e) => handleSectionChange(e.target.value)}
          disabled={isPending}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-50 disabled:cursor-wait [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {SECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
        <Link
          href="/dashboard/editorial"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          Editorial
        </Link>
      </DashboardControls>

      {/* Floating list of the remaining brand tags, opened by tapping a "+N". */}
      {tagPopover && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-6"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setTagPopover(null);
          }}
        >
          <div
            className="flex max-h-[70vh] max-w-[85vw] flex-wrap justify-center gap-2 overflow-auto rounded-xl bg-white p-4 shadow-2xl"
            style={{ border: `1px solid ${ROW_BORDER}` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {tagPopover.map((b) => (
              <span
                key={b}
                className="inline-block uppercase font-semibold tracking-wider"
                style={{
                  fontSize: "0.85rem",
                  background: CHIP_BG,
                  color: BRAND_NAVY,
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  lineHeight: 1.5,
                  border: `1px solid ${ROW_BORDER}`,
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
