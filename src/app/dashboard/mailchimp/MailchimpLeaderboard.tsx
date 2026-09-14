"use client";

import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import ViewportFit from "@/components/ViewportFit";

// Layout effect on the client (measures DOM before paint, no flash), plain
// effect on the server (no-op during SSR — avoids the useLayoutEffect warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import { useSwipeNav } from "@/lib/hooks/useSwipeNav";
import type { MailchimpDisplay } from "./page";
import {
  MAILCHIMP_SHEET_WINDOW_DAYS,
  type MailchimpSheetAudience,
  type MailchimpSheetSnapshot,
} from "@/lib/sources/mailchimpTypes";

const MC_BLACK = "#000000";
const MC_YELLOW = "#FFE01B";
const MC_INK = "#1a1a1a";
const MC_MUTED = "#6b6b6b";
const MC_RED = "#9b1c1c";
const MC_GREEN = "#166534";
const MC_AMBER = "#a16207";
const ALT_ROW_BG = "#fafafa";
const ROW_BORDER = "#e5e5e5";

const PAGE_OPTIONS = [3, 4, 5, 6];
const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];


type Props = {
  snapshot: MailchimpSheetSnapshot;
  display: MailchimpDisplay;
  /** Decided on the server, where the clock is current and shared. */
  sheetIsStale: boolean;
};

type CombinedRow = {
  key: string;
  title: string;
  members: number | null;
  openRate: number | null;
  clickRate: number | null;
  /** Lifetime unsubscribes as a count — the headline figure for the column. */
  unsubs: number | null;
  /** The same, as a share of everyone who ever joined. Shown underneath. */
  unsubRate: number | null;
  windowSubs: number | null;
  windowUnsubs: number | null;
  windowCleaned: number | null;
  windowNet: number | null;
  target: number | null;
  /** As written on the sheet — "S$282.00", "Free account", or blank. */
  monthlyCost: string | null;
  /** Subscribers as a share of target, in percent. Null without both. */
  targetPct: number | null;
  /** Per-row caveat from the sheet, shown as the audience's tooltip. */
  note: string | null;
};

function fmt(n: number): string {
  return n.toLocaleString();
}
/** A blank cell in the sheet is not a zero, so it prints as a dash. */
function fmtNum(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "—" : fmt(n);
}
/** The percentage that sits under a count. Blank when there is nothing to show. */
function pctSub(v: number | null): string | undefined {
  if (v === null || !Number.isFinite(v)) return undefined;
  return `${v.toFixed(v >= 10 ? 1 : 2)}%`;
}
function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}
/**
 * Progress toward the subscriber target. Green once met, amber from three
 * quarters of the way, otherwise plain — the same traffic-light reading the CEO
 * boards use, so "are we there yet" is answerable at a glance.
 */
function targetColor(pct: number | null): string {
  if (pct === null) return MC_MUTED;
  if (pct >= 100) return MC_GREEN;
  if (pct >= 75) return MC_AMBER;
  return MC_INK;
}

/**
 * The numeric part of a cost cell. The column is free text — "S$282.00" is a
 * figure, "Free account" is not — so anything unparseable contributes nothing
 * to the total rather than counting as zero.
 */
function parseCost(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A count with its percentage underneath. The count is the figure people act
 * on; the rate is context for it, so it is smaller and second — never the other
 * way round.
 */
function StackedValue({
  value,
  pct,
  pctColor,
  valueColor,
  bold,
}: {
  value: string;
  pct: number | null;
  pctColor?: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span
        className={`font-mono tabular-nums ${bold ? "font-bold" : ""}`}
        style={{ color: valueColor ?? MC_INK }}
      >
        {value}
      </span>
      {pct !== null && Number.isFinite(pct) && (
        <span
          className="font-mono tabular-nums"
          style={{ color: pctColor ?? MC_MUTED, fontSize: "0.72em" }}
        >
          {pct.toFixed(pct >= 10 ? 1 : 2)}%
        </span>
      )}
    </div>
  );
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function buildCombinedRows(audiences: MailchimpSheetAudience[]): CombinedRow[] {
  return audiences.map((a, i) => ({
    // The row's position, not its title. The sheet is rewritten in place by its
    // own job, so a read that lands mid-write can see the same publication
    // twice — and React refuses to render a list with a repeated key.
    key: `${i}:${a.title}`,
    title: a.title,
    members: a.subscribers,
    openRate: a.openRate,
    clickRate: a.clickRate,
    unsubs: a.unsubCount,
    unsubRate: a.unsubRate,
    windowSubs: a.added,
    windowUnsubs: a.unsubscribed,
    windowCleaned: a.cleaned,
    // The sheet computes Net itself; fall back to the arithmetic only when it
    // left that cell empty but gave us the parts.
    windowNet: a.net ?? derivedNet(a),
    target: a.target,
    monthlyCost: a.monthlyCost,
    targetPct:
      a.target !== null && a.target > 0 && a.subscribers !== null
        ? (a.subscribers / a.target) * 100
        : null,
    note: a.note,
  }));
}

function derivedNet(a: MailchimpSheetAudience): number | null {
  if (a.added === null && a.unsubscribed === null && a.cleaned === null) return null;
  return (a.added ?? 0) - (a.unsubscribed ?? 0) - (a.cleaned ?? 0);
}

/** Sums a column, ignoring blanks; null when every row was blank. */
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return present.length === 0 ? null : present.reduce((s, v) => s + v, 0);
}

export default function MailchimpLeaderboard({
  snapshot,
  display,
  sheetIsStale,
}: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  const rows = useMemo(() => buildCombinedRows(snapshot.rows), [snapshot.rows]);

  // Seeded from the admin panel's page settings; the on-screen controls still
  // override them for the rest of this session.
  const [pageSize, setPageSize] = useState<number>(display.pageSize);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(display.rotationMs);
  // Once the viewer picks a size from the controls, the narrow-screen cap steps
  // aside — they can see what they asked for.
  const [userSetPageSize, setUserSetPageSize] = useState(false);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // On a landscape phone, "Show All" scrolls the table with the header + Total
  // row pinned, instead of crushing every audience onto one screen.
  const [isShortLandscape, setIsShortLandscape] = useState(false);

  function handleRefresh() {
    // Force-clear the server cache (page reads ?cache=clear), then drop the
    // query so a subsequent reload doesn't keep clearing. This re-reads the
    // sheet — it does not make the sheet's own job run again.
    startRefresh(() => {
      router.replace(`/dashboard/mailchimp?cache=clear&t=${Date.now()}`);
    });
  }

  // A phone can't show six audiences legibly, so it caps the admin's page size
  // rather than replacing it — a board configured to show 3 stays on 3.
  const isNarrow = useMediaQuery("(max-width: 767px)");
  const effectivePageSize =
    isNarrow && !userSetPageSize ? Math.min(pageSize, 4) : pageSize;

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 600px)");
    const apply = () => setIsShortLandscape(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize));
  const displayed = rows.slice(
    pageIndex * effectivePageSize,
    (pageIndex + 1) * effectivePageSize,
  );
  const padded: (CombinedRow | null)[] = [...displayed];
  while (padded.length < effectivePageSize) padded.push(null);

  // "Show All" sets pageSize to the row count. On a landscape phone, scroll the
  // table with the header + Total pinned rather than fitting everything.
  const showingAll = rows.length > 0 && effectivePageSize >= rows.length;
  const scrollAll = isShortLandscape && showingAll;

  // Portrait mobile cards: size by the PAGE SIZE (number of slots), not how many
  // cards are actually on this page — so the last page with fewer cards looks
  // identical to a full page instead of a lone card ballooning to fill the
  // screen. Anchored at Show 3 = 0.95rem; each extra slot shrinks the base.
  // "Show All" is the exception: cards keep a readable size and the list scrolls.
  const cardBaseRem = showingAll
    ? 0.85
    : Math.max(0.5, 0.95 - (effectivePageSize - 3) * 0.15);

  // Auto-fit: shrink ALL cards uniformly just enough that the tallest one (e.g.
  // a card whose chips wrap to a 2nd line) fits its equal-height box — so every
  // card adjusts to fit on one screen with no scroll. fitScale multiplies the
  // per-card base size; it stays 1 when nothing overflows.
  const cardsGridRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);

  // Reset to full size whenever the page / data / viewport changes, then measure.
  useIsoLayoutEffect(() => {
    setFitScale(1);
  }, [rows, pageIndex, effectivePageSize]);

  useIsoLayoutEffect(() => {
    const grid = cardsGridRef.current;
    if (!grid || fitScale !== 1) return; // only measure at full size
    let worst = 1;
    for (const child of Array.from(grid.children)) {
      const el = child as HTMLElement;
      if (el.clientHeight > 0) {
        worst = Math.max(worst, el.scrollHeight / el.clientHeight);
      }
    }
    // Content scales linearly with the font, so one shrink makes it fit.
    if (worst > 1.01) setFitScale(Math.max(0.5, 1 / worst));
  }, [fitScale, rows, pageIndex, effectivePageSize]);

  // Landscape table auto-fit: the row-distribution fit isn't reliable across
  // browsers (Chrome's smaller dvh can leave the table too tall to fit, which
  // the root's overflow-hidden then clips). Measure the real overflow and shrink
  // the table font (via the --mc-fit CSS var) until it fits — no scroll, no clip.
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [tableFit, setTableFit] = useState(1);

  useIsoLayoutEffect(() => {
    setTableFit(1);
  }, [rows, pageIndex, effectivePageSize]);

  useIsoLayoutEffect(() => {
    const t = tableRef.current;
    if (!t || t.clientHeight === 0) return;
    // Shrink incrementally until it fits. Iterates (cell padding is fixed px, so
    // one pass can undershoot); the 0.5 floor bounds it. Grow-back is handled by
    // the reset-to-1 effect above when the page/data changes.
    if (t.scrollHeight > t.clientHeight * 1.01 && tableFit > 0.5) {
      setTableFit((f) => Math.max(0.5, f * (t.clientHeight / t.scrollHeight)));
    }
  }, [tableFit, rows, pageIndex, effectivePageSize]);

  // Re-measure on resize / rotation (card + table heights change).
  useEffect(() => {
    const onResize = () => {
      setFitScale(1);
      setTableFit(1);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Auto-rotate pages.
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

  // Auto-refresh data — server component re-reads cache on router.refresh.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), display.refreshMs);
    return () => clearInterval(id);
  }, [router, display.refreshMs]);

  // Viewport-scaled sizing — same clamp formula family as the editorial leaderboard.
  const count = effectivePageSize || 1;
  const eff = Math.min(count + 1, 12);
  const rowHeightVh = 70 / (count + 1);
  const fontSize = `clamp(0.8rem, min(calc(0.55vw + ${6 / eff}vw), ${rowHeightVh * 0.3}vh), 2.6rem)`;
  const headerSize = `clamp(0.65rem, min(calc(0.35vw + ${4 / eff}vw), ${rowHeightVh * 0.18}vh), 1.4rem)`;
  const totalBigSize = `clamp(1rem, calc(0.6vw + ${7 / eff}vw), 2.6rem)`;

  // Aggregate footer numbers. Every column is summed over the rows that
  // actually carry a figure, so a publication with a blank cell drags nothing
  // down — it simply isn't counted in that column.
  const totalSubs = sumOrNull(rows.map((r) => r.members));
  const avgOpen = avg(rows.filter((r) => r.openRate !== null).map((r) => r.openRate!));
  const avgClick = avg(rows.filter((r) => r.clickRate !== null).map((r) => r.clickRate!));
  const avgUnsubRate = avg(rows.filter((r) => r.unsubRate !== null).map((r) => r.unsubRate!));
  const totalUnsubsLifetime = sumOrNull(rows.map((r) => r.unsubs));
  const totalAdded = sumOrNull(rows.map((r) => r.windowSubs));
  const totalUnsubs = sumOrNull(rows.map((r) => r.windowUnsubs));
  const totalCleaned = sumOrNull(rows.map((r) => r.windowCleaned));
  const totalNet = sumOrNull(rows.map((r) => r.windowNet));
  // Only publications that actually carry a target are counted on both sides,
  // so the percentage compares like with like rather than measuring every
  // subscriber against a partial goal.
  const withTarget = rows.filter((r) => r.target !== null && r.target > 0);
  const totalTarget = sumOrNull(withTarget.map((r) => r.target));
  const subsAgainstTarget = sumOrNull(withTarget.map((r) => r.members));
  const totalTargetPct =
    totalTarget !== null && totalTarget > 0 && subsAgainstTarget !== null
      ? (subsAgainstTarget / totalTarget) * 100
      : null;
  // "Free account" and blanks contribute nothing; only real S$ figures add up.
  const totalCost = sumOrNull(rows.map((r) => parseCost(r.monthlyCost)));

  // The sheet's own LastChecked stamp — when Mailchimp was actually read, which
  // is older than when this page rendered. Formatted after mount so the server's
  // timezone never disagrees with the reader's.
  const asOf = useFormattedStamp(snapshot.lastChecked);

  // The admin panel can set a size or interval the dropdowns don't list, so the
  // current value is folded in — otherwise the select renders with nothing
  // chosen and the first change silently jumps to an unrelated option.
  const pageChoices = Array.from(new Set([...PAGE_OPTIONS, display.pageSize])).sort(
    (a, b) => a - b,
  );
  const rotationChoices = ROTATION_OPTIONS.some((o) => o.value === display.rotationMs)
    ? ROTATION_OPTIONS
    : [
        ...ROTATION_OPTIONS,
        { label: `${Math.round(display.rotationMs / 1000)} seconds`, value: display.rotationMs },
      ].sort((a, b) => a.value - b.value);

  const swipe = useSwipeNav({
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    enabled: totalPages > 1,
  });

  return (
    <div
      className="flex flex-col h-lvh pt-safe overflow-hidden"
      style={{ background: "#ffffff", color: MC_INK }}
      {...swipe}
    >
      <ViewportFit />
      {/* ---- DESKTOP / TABLET TABLE ---- */}
      <div
        className={`hidden md:flex landscape-show flex-1 min-h-0 px-0 md:px-6 flex-col ${
          scrollAll ? "overflow-y-auto" : ""
        }`}
      >
        <table
          ref={tableRef}
          className={`mc-table w-full border-collapse table-fixed ${
            scrollAll ? "mc-scroll" : "h-full"
          }`}
          style={
            {
              fontSize,
              "--mc-fit": tableFit,
            } as unknown as CSSProperties
          }
        >
          <thead>
            <tr
              className="text-left font-bold uppercase"
              style={{
                fontSize: headerSize,
                background: MC_BLACK,
                color: "#fff",
                letterSpacing: "0.10em",
              }}
            >
              <th className="px-3 sm:px-4 py-3 w-[20%]">Audience</th>
              <th className="px-2 py-3 w-[9%] text-right">Subscribers</th>
              <th className="px-2 py-3 w-[10%] text-right">Target</th>
              <th className="px-2 py-3 w-[6%] text-right">Open</th>
              <th className="px-2 py-3 w-[6%] text-right">Click</th>
              <th className="px-2 py-3 w-[6%] text-right">Unsub</th>
              <th className="px-2 py-3 w-[6%] text-right">+ {MAILCHIMP_SHEET_WINDOW_DAYS}d</th>
              <th className="px-2 py-3 w-[5%] text-right">− Uns</th>
              <th className="px-2 py-3 w-[5%] text-right">− Cln</th>
              <th className="px-2 py-3 w-[7%] text-right">Net</th>
              <th className="px-3 sm:px-4 py-3 w-[9%] text-right">Cost / mo</th>
            </tr>
            <tr>
              <td colSpan={11} style={{ padding: 0, height: 3, background: MC_YELLOW }} />
            </tr>
          </thead>
          <tbody>
            {padded.map((row, idx) => (
              <CombinedRowView
                key={row ? row.key : `empty-${idx}`}
                row={row}
                idx={idx}
                rowHeightVh={rowHeightVh}
              />
            ))}
            {/* Footer total row */}
            <tr
              style={{
                height: `${rowHeightVh}vh`,
                minHeight: 50,
                background: `linear-gradient(90deg, #ffffff, ${ALT_ROW_BG})`,
                borderTop: `2px solid ${MC_YELLOW}`,
              }}
            >
              <td
                className="px-3 sm:px-4 py-2 uppercase font-bold align-middle"
                style={{ color: MC_BLACK, letterSpacing: "0.14em", fontSize: totalBigSize }}
              >
                Total
              </td>
              <td
                className="px-2 py-2 text-right font-mono font-bold align-middle tabular-nums"
                style={{ color: MC_BLACK, fontSize: totalBigSize }}
              >
                {fmtNum(totalSubs)}
              </td>
              <td className="px-2 py-2 text-right align-middle">
                <StackedValue
                  value={fmtNum(totalTarget)}
                  pct={totalTargetPct}
                  pctColor={targetColor(totalTargetPct)}
                />
              </td>
              <td
                className="px-2 py-2 text-right font-mono align-middle tabular-nums"
                style={{ color: MC_INK }}
              >
                {fmtPct(avgOpen)}
              </td>
              <td
                className="px-2 py-2 text-right font-mono align-middle tabular-nums"
                style={{ color: MC_INK }}
              >
                {fmtPct(avgClick)}
              </td>
              <td className="px-2 py-2 text-right align-middle">
                <StackedValue value={fmtNum(totalUnsubsLifetime)} pct={avgUnsubRate} />
              </td>
              <td
                className="px-2 py-2 text-right font-mono font-bold align-middle tabular-nums"
                style={{ color: MC_BLACK }}
              >
                {signedOrDash(totalAdded)}
              </td>
              <td
                className="px-2 py-2 text-right font-mono align-middle tabular-nums"
                style={{ color: MC_RED }}
              >
                {negativeOrDash(totalUnsubs)}
              </td>
              <td
                className="px-2 py-2 text-right font-mono align-middle tabular-nums"
                style={{ color: MC_RED }}
              >
                {negativeOrDash(totalCleaned)}
              </td>
              <td
                className="px-3 sm:px-4 py-2 text-right font-mono font-bold align-middle tabular-nums"
                style={{
                  color: (totalNet ?? 0) >= 0 ? MC_BLACK : MC_RED,
                  fontSize: totalBigSize,
                }}
              >
                {signedOrDash(totalNet)}
              </td>
              <td
                className="px-3 sm:px-4 py-2 text-right font-mono align-middle tabular-nums"
                style={{ color: MC_INK, fontSize: "0.85em" }}
              >
                {totalCost === null ? "—" : `S$${fmt(Math.round(totalCost))}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- MOBILE CARDS ---- */}
      {/* Small bottom inset just clears the always-on controls handle; the panel
          opens higher up, so the cards + totals card use the full screen height. */}
      <div className="flex md:hidden landscape-hide flex-1 min-h-0 flex-col px-3 pt-2 pb-14">
        {/* Fixed number of equal slots = page size, so a card is the same height
            on every page (a lone card sits in one slot at the top, it doesn't
            stretch to fill). When a card's content is too tall (e.g. chips
            wrapping), the measure effect shrinks every card uniformly to fit.
            "Show All" instead gives each card its natural height and scrolls the
            list; the totals card below stays pinned. */}
        <div
          ref={cardsGridRef}
          className={`flex-1 min-h-0 grid gap-2 ${showingAll ? "overflow-y-auto" : ""}`}
          style={
            showingAll
              ? { gridAutoRows: "min-content" }
              : { gridTemplateRows: `repeat(${effectivePageSize}, minmax(0, 1fr))` }
          }
        >
          {displayed.map((row) => (
            <MobileCard key={row.key} row={row} baseRem={cardBaseRem * fitScale} />
          ))}
        </div>
        {/* Mobile totals card */}
        <div
          className="mt-2 shrink-0 rounded-lg px-2 py-1.5"
          style={{
            background: ALT_ROW_BG,
            border: `1.5px solid ${MC_YELLOW}`,
          }}
        >
          <div className="grid grid-cols-4 gap-x-2 gap-y-1">
            <TotalCell label="Subs" value={fmtNum(totalSubs)} bold />
            <TotalCell
              label="Target"
              value={fmtNum(totalTarget)}
              sub={pctSub(totalTargetPct)}
              subColor={targetColor(totalTargetPct)}
            />
            <TotalCell label="Open" value={fmtPct(avgOpen)} />
            <TotalCell label="Click" value={fmtPct(avgClick)} />
            <TotalCell
              label="Unsub"
              value={fmtNum(totalUnsubsLifetime)}
              sub={pctSub(avgUnsubRate)}
            />
            <TotalCell
              label={`+${MAILCHIMP_SHEET_WINDOW_DAYS}d`}
              value={signedOrDash(totalAdded)}
              bold
            />
            <TotalCell
              label="− Uns"
              value={negativeOrDash(totalUnsubs)}
              valueColor={MC_RED}
            />
            <TotalCell
              label="− Cln"
              value={negativeOrDash(totalCleaned)}
              valueColor={MC_RED}
            />
            <TotalCell
              label="Net"
              value={signedOrDash(totalNet)}
              valueColor={(totalNet ?? 0) >= 0 ? MC_BLACK : MC_RED}
              bold
            />
            <TotalCell
              label="Cost / mo"
              value={totalCost === null ? "—" : `S$${fmt(Math.round(totalCost))}`}
            />
          </div>
        </div>
      </div>

      <DashboardControls>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRefreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
        <button
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ◀ Prev
        </button>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setUserSetPageSize(true);
            setPageIndex(0);
          }}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {pageChoices.map((n) => (
            <option key={n} value={n}>
              Show {n}
            </option>
          ))}
          <option value={Math.max(rows.length, 1)}>Show All ({rows.length})</option>
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
          value={rotationInterval}
          onChange={(e) => setRotationInterval(Number(e.target.value))}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {rotationChoices.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Rotate · {opt.label}
            </option>
          ))}
        </select>
        {asOf && (
          <span
            className={`text-sm ${sheetIsStale ? "text-amber-300" : "text-white/70"}`}
            title={
              sheetIsStale
                ? `The sheet updates daily, and this reading is older than that — its job may have failed. Tab: ${snapshot.tab}`
                : `Sheet tab: ${snapshot.tab}`
            }
          >
            {sheetIsStale ? "⚠ " : ""}Sheet as of {asOf}
          </span>
        )}
        <Link
          href="/dashboard/mailchimp/reports"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          Reports →
        </Link>
      </DashboardControls>
    </div>
  );
}

/** Nothing to subscribe to — the store only distinguishes server from client. */
const subscribeNothing = () => () => {};

/**
 * Matches a media query, reported as false during SSR so the server and the
 * first client render agree. Subscribing through useSyncExternalStore keeps the
 * value in step with a rotation or resize without a setState-in-effect.
 */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Formats the sheet's ISO stamp in the reader's own timezone. Returns null
 * during SSR so the server's timezone can't disagree with the browser's and
 * trip a hydration mismatch.
 */
function useFormattedStamp(iso: string | null): string | null {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted || !iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function signedFmt(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmt(n)}`;
}

/** Movement figures: signed when present, a dash when the sheet left it blank. */
function signedOrDash(n: number | null): string {
  return n === null || !Number.isFinite(n) ? "—" : signedFmt(n);
}

/** Losses print with a leading minus; blank stays a dash, zero stays "0". */
function negativeOrDash(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n === 0 ? "0" : `−${fmt(n)}`;
}

function MobileCard({ row, baseRem }: { row: CombinedRow; baseRem: number }) {
  const netColor = (row.windowNet ?? 0) < 0 ? MC_RED : MC_BLACK;
  return (
    <div
      className="rounded-lg h-full min-h-0 overflow-hidden flex flex-col justify-between"
      style={{
        background: "#ffffff",
        border: `1px solid ${ROW_BORDER}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        // Base size for the whole card — children use em (font AND spacing) so
        // they scale together as more cards share the screen (Show 4+ shrinks vs
        // the Show 3 size), keeping content inside the card with no clipping.
        fontSize: `${baseRem}rem`,
        padding: "0.65em",
      }}
    >
      {/* Header: title + subscribers */}
      <div
        className="flex items-baseline justify-between gap-2"
        style={{ marginBottom: "0.5em" }}
      >
        <span
          className="font-bold uppercase leading-tight flex-1 min-w-0 break-words"
          style={{ color: MC_BLACK, letterSpacing: "0.04em", fontSize: "1em" }}
          title={row.note ?? undefined}
        >
          {row.title}
        </span>
        <span
          className="font-mono font-bold tabular-nums shrink-0"
          style={{ color: MC_BLACK, fontSize: "1.1em" }}
        >
          {fmtNum(row.members)}
        </span>
      </div>
      {/* Engagement rates row */}
      <div className="grid grid-cols-4 gap-2" style={{ marginBottom: "0.5em" }}>
        <Metric label="Open" value={fmtPct(row.openRate)} />
        <Metric label="Click" value={fmtPct(row.clickRate)} />
        <Metric label="Unsub" value={fmtNum(row.unsubs)} sub={pctSub(row.unsubRate)} />
        <Metric
          label="Target"
          value={fmtNum(row.target)}
          sub={pctSub(row.targetPct)}
          subColor={targetColor(row.targetPct)}
        />
      </div>
      {/* Movement row */}
      <div
        className="grid grid-cols-4 gap-2"
        style={{ borderTop: `1px dashed ${ROW_BORDER}`, paddingTop: "0.5em" }}
      >
        <Metric
          label={`+${MAILCHIMP_SHEET_WINDOW_DAYS}d`}
          value={signedOrDash(row.windowSubs)}
          valueColor={MC_BLACK}
          bold
        />
        <Metric
          label="− Uns"
          value={negativeOrDash(row.windowUnsubs)}
          valueColor={row.windowUnsubs ? MC_RED : MC_MUTED}
        />
        <Metric
          label="− Cln"
          value={negativeOrDash(row.windowCleaned)}
          valueColor={row.windowCleaned ? MC_RED : MC_MUTED}
        />
        <Metric label="Net" value={signedOrDash(row.windowNet)} valueColor={netColor} bold />
      </div>
      {row.monthlyCost && (
        <div
          className="text-right"
          style={{ color: MC_MUTED, fontSize: "0.66em", marginTop: "0.35em" }}
        >
          {row.monthlyCost} / mo
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  valueColor,
  subColor,
  bold,
}: {
  label: string;
  value: string;
  /** Context under the figure — a rate under a count, never the other way round. */
  sub?: string;
  valueColor?: string;
  subColor?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="uppercase tracking-wider" style={{ color: MC_MUTED, fontSize: "0.63em" }}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${bold ? "font-bold" : ""}`}
        style={{ color: valueColor ?? MC_INK, fontSize: "0.9em" }}
      >
        {value}
      </span>
      {sub && (
        <span
          className="font-mono tabular-nums leading-none"
          style={{ color: subColor ?? MC_MUTED, fontSize: "0.62em" }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function TotalCell({
  label,
  value,
  sub,
  valueColor,
  subColor,
  bold,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  subColor?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span
        className="uppercase tracking-wider"
        style={{ color: MC_MUTED, fontSize: "0.55rem" }}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${bold ? "font-bold" : ""}`}
        style={{ color: valueColor ?? MC_BLACK, fontSize: "0.78rem" }}
      >
        {value}
      </span>
      {sub && (
        <span
          className="font-mono tabular-nums"
          style={{ color: subColor ?? MC_MUTED, fontSize: "0.58rem" }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function CombinedRowView({
  row,
  idx,
  rowHeightVh,
}: {
  row: CombinedRow | null;
  idx: number;
  rowHeightVh: number;
}) {
  return (
    <tr
      style={{
        height: `${rowHeightVh}vh`,
        minHeight: 60,
        backgroundColor: idx % 2 === 0 ? "#ffffff" : ALT_ROW_BG,
        borderBottom: `1px solid ${ROW_BORDER}`,
      }}
    >
      <td className="px-3 sm:px-4 py-2 align-middle">
        {row && (
          <span
            className="font-bold uppercase leading-tight"
            style={{ color: MC_BLACK, letterSpacing: "0.04em" }}
            title={row.note ?? row.title}
          >
            {row.title}
          </span>
        )}
      </td>
      <td
        className="px-2 py-2 text-right font-mono font-bold align-middle tabular-nums"
        style={{ color: MC_BLACK, fontSize: "1.2em" }}
      >
        {row ? fmtNum(row.members) : ""}
      </td>
      <td className="px-2 py-2 text-right align-middle">
        {row && (
          <StackedValue
            value={fmtNum(row.target)}
            pct={row.targetPct}
            pctColor={targetColor(row.targetPct)}
          />
        )}
      </td>
      <td
        className="px-2 py-2 text-right font-mono align-middle tabular-nums"
        style={{ color: MC_INK }}
      >
        {row ? fmtPct(row.openRate) : ""}
      </td>
      <td
        className="px-2 py-2 text-right font-mono align-middle tabular-nums"
        style={{ color: MC_INK }}
      >
        {row ? fmtPct(row.clickRate) : ""}
      </td>
      <td className="px-2 py-2 text-right align-middle">
        {row && <StackedValue value={fmtNum(row.unsubs)} pct={row.unsubRate} />}
      </td>
      <td
        className="px-2 py-2 text-right font-mono font-bold align-middle tabular-nums"
        style={{ color: MC_BLACK }}
      >
        {row ? signedOrDash(row.windowSubs) : ""}
      </td>
      <td
        className="px-2 py-2 text-right font-mono align-middle tabular-nums"
        style={{ color: row?.windowUnsubs ? MC_RED : MC_MUTED }}
      >
        {row ? negativeOrDash(row.windowUnsubs) : ""}
      </td>
      <td
        className="px-2 py-2 text-right font-mono align-middle tabular-nums"
        style={{ color: row?.windowCleaned ? MC_RED : MC_MUTED }}
      >
        {row ? negativeOrDash(row.windowCleaned) : ""}
      </td>
      <td
        className="px-3 sm:px-4 py-2 text-right font-mono font-bold align-middle tabular-nums"
        style={{
          color: row && (row.windowNet ?? 0) < 0 ? MC_RED : MC_BLACK,
          fontSize: "1.15em",
        }}
      >
        {row ? signedOrDash(row.windowNet) : ""}
      </td>
      <td
        className="px-3 sm:px-4 py-2 text-right font-mono align-middle tabular-nums"
        style={{ color: MC_MUTED, fontSize: "0.85em" }}
      >
        {row ? (row.monthlyCost ?? "—") : ""}
      </td>
    </tr>
  );
}
