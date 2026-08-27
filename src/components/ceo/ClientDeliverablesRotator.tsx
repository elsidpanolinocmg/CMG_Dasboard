"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import type { CampaignDeliverables } from "@/lib/ceo-deliverables/deliverables";

/** How many cards a category shows at once. */
const PAGE_SIZE = 4;

/** The rotation-speed choices offered in the dashboard controls. */
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
 * "Done" is green; every other status runs through one harmonious blue–teal
 * family (teal → cyan → sky → blue), assigned in legend order (most common
 * first). Kept next to the green (no jump to purple) so it flows rather than
 * fights, and stays lively without turning into a rainbow.
 */
const DONE_COLOR = "#0ca30c";
const COOL_RAMP = ["#0d9488", "#0891b2", "#0284c7", "#2563eb", "#60a5fa"]; // teal → cyan → sky → blue
const STATUS_FALLBACK = "#cbd5e1";

/** Build the status→colour map from the ordered legend (Done first). */
function buildStatusColors(legend: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  let cool = 0;
  for (const s of legend) {
    const key = s.toLowerCase();
    if (key === "done") colors.set(key, DONE_COLOR);
    else colors.set(key, COOL_RAMP[Math.min(cool++, COOL_RAMP.length - 1)]);
  }
  return colors;
}
function colorOf(colors: Map<string, string>, status: string): string {
  return colors.get(status.toLowerCase()) ?? STATUS_FALLBACK;
}

/**
 * How alarming a campaign's overdue backlog is — a blend of how much of the
 * campaign is still undone and how big the absolute pile is, so a nearly-finished
 * campaign isn't flagged red just for a high raw count, yet a genuinely large pile
 * still escalates:
 *   high (red)    — under 60% done AND at least 6 remaining
 *   medium (orange) — under 85% done, OR 10+ remaining
 *   low (amber)   — otherwise (nearly done with a small pile left)
 */
type Backlog = "low" | "medium" | "high";
function backlogSeverity(done: number, total: number): Backlog {
  const outstanding = total - done;
  const pctDone = total ? (done / total) * 100 : 0;
  if (pctDone < 60 && outstanding >= 6) return "high";
  if (pctDone < 85 || outstanding >= 10) return "medium";
  return "low";
}

/** A little pennant flag, coloured by backlog severity (via CSS `data-severity`). */
function BacklogFlag({ severity, outstanding }: { severity: Backlog; outstanding: number }) {
  return (
    <svg
      className={styles.delivLabelFlag}
      data-severity={severity}
      viewBox="0 0 24 24"
      role="img"
      aria-label={`${severity} backlog`}
    >
      <title>{`${outstanding} outstanding — ${severity} backlog`}</title>
      {/* Pole. */}
      <rect x="4" y="2" width="2.2" height="20" rx="1.1" fill="currentColor" />
      {/* Rectangular banner on the pole. */}
      <rect x="6" y="3" width="13.5" height="8" rx="0.8" fill="currentColor" />
    </svg>
  );
}

/** One campaign as a card: name and % at the top, count and deadline at the foot. */
function DeliverableCard({
  c,
  state,
  verb,
  colors,
}: {
  c: CampaignDeliverables;
  state: "overdue" | "ontrack";
  verb: string;
  colors: Map<string, string>;
}) {
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return (
    <div className={styles.delivCard} data-state={state}>
      <div className={styles.delivCardMain}>
        <span className={styles.delivCardName}>{c.campaign}</span>
        <span className={styles.delivCardPct}>{pct}%</span>
        <div
          className={styles.delivStatusBar}
          role="img"
          aria-label={`Status mix: ${c.statuses.map((s) => `${s.status} ${s.count}`).join(", ")}`}
        >
          {c.statuses.map((s) => (
            <span
              key={s.status}
              className={styles.delivStatusSeg}
              style={{ width: `${(s.count / c.total) * 100}%`, background: colorOf(colors, s.status) }}
              title={`${s.status}: ${s.count}`}
            />
          ))}
        </div>
      </div>
      <div className={styles.delivCardFoot}>
        <span className={styles.delivCardCount} data-state={state}>
          {state === "overdue" && <BacklogFlag severity={backlogSeverity(c.done, c.total)} outstanding={c.outstanding} />}
          {c.outstanding} {verb}
        </span>
        <span className={styles.delivCardDue}>{c.dueLabel}</span>
      </div>
    </div>
  );
}

interface RotatingCardsProps {
  rows: CampaignDeliverables[];
  state: "overdue" | "ontrack";
  verb: string;
  empty: string;
  /** Milliseconds per page; 0 pauses the rotation. */
  intervalMs: number;
  colors: Map<string, string>;
}

/**
 * A category's cards, four at a time. When a category has more than four
 * campaigns it cycles through them page by page (unless paused), so a long list
 * stays legible on a wallboard instead of shrinking to fit.
 */
function RotatingCards({ rows, state, verb, empty, intervalMs, colors }: RotatingCardsProps) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  // Timestamp of the viewer's last manual page change; auto-advance holds off for
  // a beat after it so a manual browse isn't yanked to the next page mid-read.
  const heldAt = useRef(0);

  // Jump to a page (wrapping) and register the interaction so rotation pauses.
  const goTo = (i: number) => {
    setPage(((i % totalPages) + totalPages) % totalPages);
    heldAt.current = Date.now();
  };

  // Reset to the first page whenever the list changes (e.g. a data refresh).
  useEffect(() => {
    setPage(0);
  }, [rows.length]);

  useEffect(() => {
    if (totalPages <= 1 || intervalMs <= 0) return;
    const hold = Math.max(intervalMs, 15_000);
    const t = setInterval(() => {
      if (Date.now() - heldAt.current < hold) return; // skip while recently browsed
      setPage((p) => (p + 1) % totalPages);
    }, intervalMs);
    return () => clearInterval(t);
  }, [totalPages, intervalMs]);

  if (rows.length === 0) {
    return <div className={styles.delivEmpty}>{empty}</div>;
  }

  const current = page % totalPages;
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  // Stop pager interactions from bubbling to the window bottom-zone handler that
  // opens the DashboardControls overlay — the pager sits inside that zone.
  const stopBubble = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <>
      {/* The card stage holds the (re-keyed, fading) grid plus hover-reveal prev/next
          arrows overlaid on its left and right edges — clear of the bottom controls
          zone, so paging never pops the controls overlay. */}
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
        {/* `key={current}` remounts the grid on each page turn, replaying the
            fade-in animation so the rotation crossfades rather than snapping. */}
        <div className={styles.delivCardGrid} key={current}>
          {shown.map((c) => (
            <DeliverableCard key={c.campaign} c={c} state={state} verb={verb} colors={colors} />
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
      {/* One clickable dot per page (current filled) — a compact indicator that also
          lets touch users page. Shown even for a single page so both columns end at
          the same height. */}
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

export interface DeliverablesBodyProps {
  overdue: CampaignDeliverables[];
  onTrack: CampaignDeliverables[];
  statusLegend: string[];
}

/**
 * The two category columns, a shared status legend, and the dashboard controls,
 * all sharing one rotation speed. Client-side so the timer and the speed selector
 * can talk to each other.
 */
export function DeliverablesBody({ overdue, onTrack, statusLegend }: DeliverablesBodyProps) {
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL);
  const statusColors = buildStatusColors(statusLegend);

  return (
    <>
      <div className={styles.delivBody}>
        <div className={styles.delivColumns}>
          <div className={styles.delivColumn} data-state="overdue">
            <div className={styles.deliverablesGroupLabel}>Overdue · past deadline</div>
            <RotatingCards
              rows={overdue}
              state="overdue"
              verb="pending"
              empty="Nothing overdue — every past-deadline deliverable is done."
              intervalMs={intervalMs}
            colors={statusColors}
            />
          </div>

          <div className={styles.delivColumn} data-state="ontrack">
            <div className={styles.deliverablesGroupLabel} data-track="true">On track · deadline ahead</div>
            <RotatingCards
              rows={onTrack}
              state="ontrack"
              verb="in progress"
              empty="No upcoming campaigns with work outstanding."
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
