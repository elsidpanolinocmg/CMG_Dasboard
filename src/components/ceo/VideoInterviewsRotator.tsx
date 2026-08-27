"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import type { CampaignInterviews } from "@/lib/ceo-video-interviews/interviews";

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
 * The two finished states are greens (Published the deeper, Approved the lighter);
 * every in-production status runs through one harmonious blue–teal family (teal →
 * cyan → sky → blue), assigned in legend order. Kept next to the greens so the bar
 * flows from "done" through the pipeline rather than fighting as a rainbow.
 */
const DONE_COLORS: Record<string, string> = { published: "#0ca30c", approved: "#34c759" };
const COOL_RAMP = ["#0d9488", "#0891b2", "#0284c7", "#2563eb", "#60a5fa", "#93c5fd"]; // teal → sky → blue
const STATUS_FALLBACK = "#cbd5e1";

/** Build the status→colour map from the ordered legend (complete statuses first). */
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

/** One campaign as a card: name and % at the top, counts at the foot. */
function InterviewCard({
  c,
  state,
  colors,
}: {
  c: CampaignInterviews;
  state: "production" | "complete";
  colors: Map<string, string>;
}) {
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return (
    <div className={styles.delivCard} data-state={state === "production" ? "overdue" : "ontrack"}>
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
        <span className={styles.delivCardCount} data-state={state === "production" ? "overdue" : "ontrack"}>
          {state === "production" && <span className={styles.delivLabelDot} data-state="overdue" aria-hidden="true" />}
          {state === "production" ? `${c.outstanding} in production` : "All published"}
        </span>
        <span className={styles.delivCardDue}>
          {c.done}/{c.total} done
        </span>
      </div>
    </div>
  );
}

interface RotatingCardsProps {
  rows: CampaignInterviews[];
  state: "production" | "complete";
  empty: string;
  /** Milliseconds per page; 0 pauses the rotation. */
  intervalMs: number;
  colors: Map<string, string>;
}

/**
 * A category's cards, four at a time. When a category has more than four campaigns
 * it cycles through them page by page (unless paused), so a long list stays legible
 * on a wallboard instead of shrinking to fit.
 */
function RotatingCards({ rows, state, empty, intervalMs, colors }: RotatingCardsProps) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [rows.length]);

  useEffect(() => {
    if (totalPages <= 1 || intervalMs <= 0) return;
    const t = setInterval(() => setPage((p) => (p + 1) % totalPages), intervalMs);
    return () => clearInterval(t);
  }, [totalPages, intervalMs]);

  if (rows.length === 0) {
    return <div className={styles.delivEmpty}>{empty}</div>;
  }

  const current = page % totalPages;
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className={styles.delivCardGrid} key={current}>
        {shown.map((c) => (
          <InterviewCard key={c.campaign} c={c} state={state} colors={colors} />
        ))}
      </div>
      <div className={styles.delivPager} aria-label={`Page ${current + 1} of ${totalPages}`}>
        {Array.from({ length: totalPages }, (_, i) => (
          <span key={i} className={styles.delivPagerDot} data-active={i === current} aria-hidden="true" />
        ))}
      </div>
    </>
  );
}

export interface VideoInterviewsBodyProps {
  inProduction: CampaignInterviews[];
  completed: CampaignInterviews[];
  statusLegend: string[];
}

/**
 * The two category columns, a shared status legend, and the dashboard controls,
 * all sharing one rotation speed. Client-side so the timer and the speed selector
 * can talk to each other.
 */
export function VideoInterviewsBody({ inProduction, completed, statusLegend }: VideoInterviewsBodyProps) {
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL);
  const statusColors = buildStatusColors(statusLegend);

  return (
    <>
      <div className={styles.delivBody}>
        <div className={styles.delivColumns}>
          <div className={styles.delivColumn} data-state="overdue">
            <div className={styles.deliverablesGroupLabel}>In production · not yet published</div>
            <RotatingCards
              rows={inProduction}
              state="production"
              empty="Nothing in production — every interview is published."
              intervalMs={intervalMs}
              colors={statusColors}
            />
          </div>

          <div className={styles.delivColumn} data-state="ontrack">
            <div className={styles.deliverablesGroupLabel} data-track="true">Completed · all published</div>
            <RotatingCards
              rows={completed}
              state="complete"
              empty="No campaign is fully published yet."
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
