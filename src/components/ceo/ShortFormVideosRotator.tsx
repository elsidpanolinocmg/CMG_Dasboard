"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import type { AwardVideos } from "@/lib/ceo-sfv/sheet";

/** How many cards a column shows at once. */
const PAGE_SIZE = 4;

const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "5 seconds", value: 5_000 },
  { label: "8 seconds", value: 8_000 },
  { label: "15 seconds", value: 15_000 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
];
const DEFAULT_INTERVAL = 8_000;

const CONTROL_BTN = "rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70";

/**
 * The three "reached the client" states are greens (Approved deepest, then Proceed
 * by default, then Sent to client); every in-production status runs through one
 * teal→blue family in legend order, so the bar reads from done back up the pipeline.
 */
const DONE_COLORS: Record<string, string> = {
  approved: "#0ca30c",
  "proceed by default": "#34c759",
  "sent to client": "#6fcf6f",
};
const COOL_RAMP = ["#0d9488", "#0891b2", "#0284c7", "#2563eb", "#60a5fa", "#93c5fd"];
const STATUS_FALLBACK = "#cbd5e1";

function buildStatusColors(legend: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  let cool = 0;
  for (const s of legend) {
    const key = s.toLowerCase();
    if (DONE_COLORS[key]) colors.set(key, DONE_COLORS[key]);
    else colors.set(key, COOL_RAMP[Math.min(cool++, COOL_RAMP.length - 1)]);
  }
  return colors;
}
function colorOf(colors: Map<string, string>, status: string): string {
  return colors.get(status.toLowerCase()) ?? STATUS_FALLBACK;
}

/**
 * How alarming an award's overdue backlog is — a blend of how much is still unsent
 * and how many videos are actually late, so a nearly-finished award isn't flagged red
 * for a single slip, yet a large late pile still escalates.
 */
type Backlog = "low" | "medium" | "high";
function backlogSeverity(done: number, total: number, overdueCount: number): Backlog {
  const pctDone = total ? (done / total) * 100 : 0;
  if (pctDone < 60 && overdueCount >= 6) return "high";
  if (pctDone < 85 || overdueCount >= 10) return "medium";
  return "low";
}

/** A little pennant flag, coloured by backlog severity (via CSS `data-severity`). */
function BacklogFlag({ severity, count }: { severity: Backlog; count: number }) {
  return (
    <svg className={styles.delivLabelFlag} data-severity={severity} viewBox="0 0 24 24" role="img" aria-label={`${severity} backlog`}>
      <title>{`${count} past deadline — ${severity} backlog`}</title>
      <rect x="4" y="2" width="2.2" height="20" rx="1.1" fill="currentColor" />
      <rect x="6" y="3" width="13.5" height="8" rx="0.8" fill="currentColor" />
    </svg>
  );
}

/** One awards programme as a card: name and % at the top, count and deadline at the foot. */
function AwardCard({
  a,
  state,
  colors,
}: {
  a: AwardVideos;
  state: "overdue" | "ontrack";
  colors: Map<string, string>;
}) {
  const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
  // A late award counts its late videos; an undated one (in the same column) isn't
  // late, so it counts what's still in production instead and carries no flag.
  const late = a.overdueCount > 0;
  const countLabel = late
    ? `${a.overdueCount} overdue`
    : a.outstanding === 0
      ? "Completed"
      : `${a.outstanding} in production`;
  return (
    <div className={styles.delivCard} data-state={state}>
      <div className={styles.delivCardMain}>
        <span className={styles.delivCardName} title={a.award}>
          {a.award}
        </span>
        <span className={styles.delivCardPct}>{pct}%</span>
        <div
          className={styles.delivStatusBar}
          role="img"
          aria-label={`Status mix: ${a.statuses.map((s) => `${s.status} ${s.count}`).join(", ")}`}
        >
          {a.statuses.map((s) => (
            <span
              key={s.status}
              className={styles.delivStatusSeg}
              style={{ width: `${(s.count / a.total) * 100}%`, background: colorOf(colors, s.status) }}
              title={`${s.status}: ${s.count}`}
            />
          ))}
        </div>
      </div>
      <div className={styles.delivCardFoot}>
        <span className={styles.delivCardCount} data-state={state}>
          {late && <BacklogFlag severity={backlogSeverity(a.done, a.total, a.overdueCount)} count={a.overdueCount} />}
          {countLabel}
        </span>
        <span className={styles.delivCardDue} data-soon={state === "ontrack" && a.dueSoon ? "true" : undefined}>
          {a.dueLabel}
        </span>
      </div>
    </div>
  );
}

interface RotatingCardsProps {
  rows: AwardVideos[];
  state: "overdue" | "ontrack";
  empty: string;
  /** Milliseconds per page; 0 pauses the rotation. */
  intervalMs: number;
  colors: Map<string, string>;
}

/**
 * A column's cards, four at a time. Longer lists cycle page by page (unless paused);
 * the edge arrows and dots let a viewer page manually, which holds the rotation for
 * a beat so it doesn't jump mid-read.
 */
function RotatingCards({ rows, state, empty, intervalMs, colors }: RotatingCardsProps) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const heldAt = useRef(0);

  const goTo = (i: number) => {
    setPage(((i % totalPages) + totalPages) % totalPages);
    heldAt.current = Date.now();
  };

  useEffect(() => {
    setPage(0);
  }, [rows.length]);

  useEffect(() => {
    if (totalPages <= 1 || intervalMs <= 0) return;
    const hold = Math.max(intervalMs, 15_000);
    const t = setInterval(() => {
      if (Date.now() - heldAt.current < hold) return;
      setPage((p) => (p + 1) % totalPages);
    }, intervalMs);
    return () => clearInterval(t);
  }, [totalPages, intervalMs]);

  if (rows.length === 0) {
    return <div className={styles.delivEmpty}>{empty}</div>;
  }

  const current = page % totalPages;
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  // Keep pager clicks from reaching the bottom-zone handler that opens the controls.
  const stopBubble = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <>
      <div className={styles.delivCardStage}>
        {totalPages > 1 && (
          <button
            type="button"
            className={styles.delivStageArrow}
            data-side="left"
            onPointerDown={stopBubble}
            onClick={() => goTo(current - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>
        )}
        <div className={styles.delivCardGrid} key={current}>
          {shown.map((a) => (
            <AwardCard key={a.award} a={a} state={state} colors={colors} />
          ))}
        </div>
        {totalPages > 1 && (
          <button
            type="button"
            className={styles.delivStageArrow}
            data-side="right"
            onPointerDown={stopBubble}
            onClick={() => goTo(current + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        )}
      </div>
      <div
        className={styles.delivPager}
        role="group"
        aria-label={`Page ${current + 1} of ${totalPages}`}
        onPointerDown={stopBubble}
      >
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            type="button"
            className={styles.delivPagerDot}
            data-active={i === current}
            onClick={() => goTo(i)}
            aria-label={`Page ${i + 1}`}
            aria-current={i === current ? "true" : undefined}
          />
        ))}
      </div>
    </>
  );
}

export interface ShortFormVideosBodyProps {
  overdue: AwardVideos[];
  onTrack: AwardVideos[];
  statusLegend: string[];
}

/** The two columns, a shared status legend, and the controls, on one rotation speed. */
export function ShortFormVideosBody({ overdue, onTrack, statusLegend }: ShortFormVideosBodyProps) {
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL);
  const statusColors = buildStatusColors(statusLegend);

  return (
    <>
      <div className={styles.delivBody}>
        <div className={styles.delivColumns}>
          <div className={styles.delivColumn} data-state="overdue">
            <div className={styles.deliverablesGroupLabel}>Overdue · past or no deadline</div>
            <RotatingCards
              rows={overdue}
              state="overdue"
              empty="Nothing overdue — every video in production has a deadline ahead."
              intervalMs={intervalMs}
              colors={statusColors}
            />
          </div>

          <div className={styles.delivColumn} data-state="ontrack">
            <div className={styles.deliverablesGroupLabel} data-track="true">
              On track · deadline ahead
            </div>
            <RotatingCards
              rows={onTrack}
              state="ontrack"
              empty="No awards on track."
              intervalMs={intervalMs}
              colors={statusColors}
            />
          </div>
        </div>

        {statusLegend.length > 0 && (
          <div className={styles.delivLegend}>
            {statusLegend.map((s) => (
              <span key={s} className={styles.delivLegendItem}>
                <span className={styles.delivLegendDot} style={{ background: colorOf(statusColors, s) }} aria-hidden="true" />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <DashboardControls>
        <Link href="/dashboard/ceo" className={CONTROL_BTN}>
          ← Back
        </Link>
        <label className="flex items-center gap-2 text-white/80">
          <span className="text-sm">Rotate</span>
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            className={`${CONTROL_BTN} [&>option]:bg-gray-800 [&>option]:text-white`}
            aria-label="Card rotation speed"
          >
            {ROTATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <RefreshButton className={`${CONTROL_BTN} disabled:opacity-60`} />
      </DashboardControls>
    </>
  );
}
