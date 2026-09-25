"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import type { DetailItem } from "@/lib/ceo/detail-item";
import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";

/**
 * The card-board layout shared by the CEO deliverable trackers (PRs & Interviews,
 * Video Interviews, Magazine Materials, Short Form Videos): two columns of cards
 * that page four at a time, a shared status legend, and the dashboard controls.
 * Each board supplies its rows and how one row becomes a `BoardCard`.
 */

/** How many cards a column shows at once. */
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

export interface StatusSlice {
  status: string;
  count: number;
}

export type CardState = "overdue" | "ontrack";

/* ------------------------------------------------------------------ colours */

/**
 * Finished states take the greens a board passes in; every other status runs
 * through one teal → cyan → sky → blue family, assigned in legend order (most
 * common first), so a bar flows from done back up the pipeline instead of reading
 * as a rainbow.
 */
const COOL_RAMP = ["#0d9488", "#0891b2", "#0284c7", "#2563eb", "#60a5fa", "#93c5fd"];
const STATUS_FALLBACK = "#cbd5e1";

/** The status → colour map for a legend; `doneColors` is keyed by lower-case status. */
export function buildStatusColors(legend: string[], doneColors: Record<string, string>): Map<string, string> {
  const colors = new Map<string, string>();
  let cool = 0;
  for (const s of legend) {
    const key = s.toLowerCase();
    colors.set(key, doneColors[key] ?? COOL_RAMP[Math.min(cool++, COOL_RAMP.length - 1)]);
  }
  return colors;
}

function colorOf(colors: Map<string, string>, status: string): string {
  return colors.get(status.toLowerCase()) ?? STATUS_FALLBACK;
}

/* --------------------------------------------------------------- backlog flag */

export type Backlog = "low" | "medium" | "high";

/**
 * How alarming a late backlog is — a blend of how much is still undone and how
 * big the late pile is, so a nearly-finished item isn't flagged red for a high raw
 * count, yet a genuinely large pile still escalates:
 *   high (red)      — under 60% done AND at least 6 late
 *   medium (orange) — under 85% done, OR 10+ late
 *   low (amber)     — otherwise (nearly done with a small pile left)
 */
export function backlogSeverity(done: number, total: number, lateCount: number): Backlog {
  const pctDone = total ? (done / total) * 100 : 0;
  if (pctDone < 60 && lateCount >= 6) return "high";
  if (pctDone < 85 || lateCount >= 10) return "medium";
  return "low";
}

/** A little pennant flag, coloured by backlog severity (via CSS `data-severity`). */
function BacklogFlag({ severity, title }: { severity: Backlog; title: string }) {
  return (
    <svg className={styles.delivLabelFlag} data-severity={severity} viewBox="0 0 24 24" role="img" aria-label={`${severity} backlog`}>
      <title>{title}</title>
      {/* Pole. */}
      <rect x="4" y="2" width="2.2" height="20" rx="1.1" fill="currentColor" />
      {/* Rectangular banner on the pole. */}
      <rect x="6" y="3" width="13.5" height="8" rx="0.8" fill="currentColor" />
    </svg>
  );
}

/* ----------------------------------------------------------------------- card */

export interface BoardCardProps {
  name: string;
  /** Hover text for the name, where a long one gets clipped. */
  nameTitle?: string;
  /** The headline percentage, already rounded. */
  pct: number;
  statuses: StatusSlice[];
  /** What the status bar's segments are a share of. */
  total: number;
  colors: Map<string, string>;
  state: CardState;
  /** Shown before the count when something is late. */
  flag?: { severity: Backlog; title: string } | null;
  countLabel: string;
  dueLabel: string;
  /** Turns the deadline into the amber "due soon" chip. */
  dueSoon?: boolean;
  /** Makes the card open its detail panel (click, tap, or Enter/Space). */
  onOpen?: () => void;
}

/** One card: name and % at the top, a status bar, then the count and deadline at the foot. */
export function BoardCard({
  name,
  nameTitle,
  pct,
  statuses,
  total,
  colors,
  state,
  flag,
  countLabel,
  dueLabel,
  dueSoon,
  onOpen,
}: BoardCardProps) {
  return (
    <div
      className={styles.delivCard}
      data-state={state}
      data-openable={onOpen ? "true" : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-haspopup={onOpen ? "dialog" : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      // A card low on the screen sits in the bottom zone that toggles the controls
      // overlay; opening a card shouldn't also pop the controls.
      onPointerDown={onOpen ? (e) => e.stopPropagation() : undefined}
    >
      <div className={styles.delivCardMain}>
        <span className={styles.delivCardName} title={nameTitle}>
          {name}
        </span>
        <span className={styles.delivCardPct}>{pct}%</span>
        <div
          className={styles.delivStatusBar}
          role="img"
          aria-label={`Status mix: ${statuses.map((s) => `${s.status} ${s.count}`).join(", ")}`}
        >
          {statuses.map((s) => (
            <span
              key={s.status}
              className={styles.delivStatusSeg}
              style={{ width: `${(s.count / total) * 100}%`, background: colorOf(colors, s.status) }}
              title={`${s.status}: ${s.count}`}
            />
          ))}
        </div>
      </div>
      <div className={styles.delivCardFoot}>
        <span className={styles.delivCardCount} data-state={state}>
          {flag && <BacklogFlag severity={flag.severity} title={flag.title} />}
          {countLabel}
        </span>
        <span className={styles.delivCardDue} data-soon={dueSoon ? "true" : undefined}>
          {dueLabel}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the columns */

export interface BoardColumn<T> {
  /** The column heading, e.g. "Overdue · past deadline". */
  label: string;
  state: CardState;
  rows: T[];
  /** Shown instead of cards when the column has none. */
  empty: string;
  getKey: (row: T) => string;
  /** `open` is set when the board has detail panels; pass it to the card as `onOpen`. */
  renderCard: (row: T, open?: () => void) => ReactNode;
}

/**
 * A column's cards, four at a time. Longer lists cycle page by page (unless
 * paused), so they stay legible on a wallboard instead of shrinking to fit; the
 * edge arrows and dots let a viewer page by hand, which holds the rotation for a
 * beat so it doesn't jump mid-read.
 */
function RotatingCards<T>({
  column,
  intervalMs,
  onOpen,
}: {
  column: BoardColumn<T>;
  intervalMs: number;
  onOpen?: (row: T) => void;
}) {
  const { rows, empty, getKey, renderCard } = column;
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

  // Back to the first page whenever the list changes size (e.g. after a refresh) —
  // adjusted during render rather than in an effect, so it costs no extra pass.
  const [pagedLength, setPagedLength] = useState(rows.length);
  if (pagedLength !== rows.length) {
    setPagedLength(rows.length);
    setPage(0);
  }

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

  // Keep pager clicks from reaching the window's bottom-zone handler that opens the
  // DashboardControls overlay — the pager sits inside that zone.
  const stopBubble = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <>
      {/* The card stage holds the (re-keyed, fading) grid plus hover-reveal prev/next
          arrows on its edges — clear of the bottom controls zone. */}
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
            fade-in so the rotation crossfades rather than snapping. */}
        <div className={styles.delivCardGrid} key={current}>
          {shown.map((row) => (
            <Fragment key={getKey(row)}>{renderCard(row, onOpen ? () => onOpen(row) : undefined)}</Fragment>
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
      {/* One clickable dot per page (current filled). Shown even for a single page
          so both columns end at the same height. */}
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

/* ------------------------------------------------------------- detail panel */

/** What a card opens to: the items behind its numbers. */
export interface CardDetails {
  title: string;
  /** One line under the title, e.g. "11 of 106 not yet published · 6 months overdue". */
  summary: string;
  items: DetailItem[];
  /** Heading for the name column; defaults to "Client". */
  nameLabel?: string;
  /** Heading for the board-specific extra column, when there is one. */
  extraLabel?: string;
  /** What "done" means on this board, for the counts line; defaults to "done". */
  doneLabel?: string;
}

/** An untouched panel closes itself, so a wall display never stays stuck on it. */
const DETAIL_IDLE_CLOSE_MS = 60_000;

type Tone = "late" | "open" | "done";
const toneOf = (item: DetailItem): Tone => (item.late ? "late" : item.done ? "done" : "open");
const TONE_ORDER: Record<Tone, number> = { late: 0, open: 1, done: 2 };
const TONE_TITLE: Record<Tone, string> = { late: "Late", open: "In progress", done: "Done" };

/**
 * The items behind one card — late first, then in progress, then done — over the
 * board. Closes with ×, Escape, a click outside, or a minute without anyone
 * touching it.
 */
function DetailPanel({ details, onClose }: { details: CardDetails; onClose: () => void }) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  const items = [...(details.items ?? [])].sort(
    (a, b) => TONE_ORDER[toneOf(a)] - TONE_ORDER[toneOf(b)] || a.name.localeCompare(b.name),
  );
  const count = (tone: Tone) => items.filter((item) => toneOf(item) === tone).length;
  const hasExtra = !!details.extraLabel && items.some((item) => item.extra);
  const hasDeadline = items.some((item) => item.deadline);

  useEffect(() => {
    closeButton.current?.focus();
    let idle = setTimeout(onClose, DETAIL_IDLE_CLOSE_MS);
    const stillHere = () => {
      clearTimeout(idle);
      idle = setTimeout(onClose, DETAIL_IDLE_CLOSE_MS);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else stillHere();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", stillHere);
    window.addEventListener("pointerdown", stillHere);
    window.addEventListener("scroll", stillHere, true);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", stillHere);
      window.removeEventListener("pointerdown", stillHere);
      window.removeEventListener("scroll", stillHere, true);
    };
  }, [onClose]);

  // Clicks here must not reach the bottom-zone handler that toggles the controls.
  const stopBubble = (e: ReactPointerEvent) => e.stopPropagation();

  return (
    <div className={styles.delivDetailBackdrop} onPointerDown={stopBubble} onClick={onClose}>
      <div
        className={styles.delivDetailPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.delivDetailHead}>
          <div>
            <h2 id={titleId} className={styles.delivDetailTitle}>
              {details.title}
            </h2>
            <div className={styles.delivDetailSummary}>{details.summary}</div>
            <div className={styles.delivDetailCounts}>
              {count("late")} late · {count("open")} in progress · {count("done")} {details.doneLabel ?? "done"}
            </div>
          </div>
          <button ref={closeButton} type="button" className={styles.delivDetailClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.delivDetailScroll}>
          {items.length === 0 ? (
            <div className={styles.delivEmpty}>Nothing behind this card yet.</div>
          ) : (
            <table className={styles.delivDetailTable}>
              <thead>
                <tr>
                  <th aria-label="State" />
                  <th>{details.nameLabel ?? "Client"}</th>
                  <th>Status</th>
                  {hasExtra && <th>{details.extraLabel}</th>}
                  {hasDeadline && <th>Deadline</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const tone = toneOf(item);
                  return (
                    <tr key={i} data-tone={tone}>
                      <td>
                        <span className={styles.delivDetailDot} data-tone={tone} title={TONE_TITLE[tone]} />
                      </td>
                      <td>{item.name}</td>
                      <td>{item.status}</td>
                      {hasExtra && <td>{item.extra ?? ""}</td>}
                      {hasDeadline && <td>{item.deadline ?? ""}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export interface CardBoardProps<T> {
  /** The left (needs attention) and right (on track) columns. */
  columns: [BoardColumn<T>, BoardColumn<T>];
  statusLegend: string[];
  colors: Map<string, string>;
  /** Cache prefixes the Refresh button clears before re-reading. */
  refreshCache?: string[];
  /** What a card opens to; without it, cards aren't clickable. */
  details?: (row: T) => CardDetails;
}

/**
 * The two columns, the shared status legend, and the dashboard controls, all on
 * one rotation speed. Client-side so the timer and the speed selector can talk.
 */
export function CardBoard<T>({ columns, statusLegend, colors, refreshCache, details }: CardBoardProps<T>) {
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeDetails = useCallback(() => setOpenKey(null), []);

  // The open card is looked up afresh each render, so a refresh shows its new
  // figures; if a refresh drops it altogether, the panel simply closes.
  let openRow: T | undefined;
  if (openKey !== null) {
    for (const column of columns) {
      openRow = column.rows.find((row) => column.getKey(row) === openKey);
      if (openRow !== undefined) break;
    }
    if (openRow === undefined) setOpenKey(null);
  }

  return (
    <>
      <div className={styles.delivBody}>
        <div className={styles.delivColumns}>
          {columns.map((column) => (
            <div key={column.state} className={styles.delivColumn} data-state={column.state}>
              <div
                className={styles.deliverablesGroupLabel}
                data-track={column.state === "ontrack" ? "true" : undefined}
              >
                {column.label}
              </div>
              <RotatingCards
                column={column}
                // Rotation pauses while a card's panel is open.
                intervalMs={openRow !== undefined ? 0 : intervalMs}
                onOpen={details ? (row) => setOpenKey(column.getKey(row)) : undefined}
              />
            </div>
          ))}
        </div>

        {statusLegend.length > 0 && (
          <div className={styles.delivLegend}>
            {statusLegend.map((s) => (
              <span key={s} className={styles.delivLegendItem}>
                <span className={styles.delivLegendDot} style={{ background: colorOf(colors, s) }} aria-hidden="true" />
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
        <RefreshButton className={`${CONTROL_BTN} disabled:opacity-60`} clearCache={refreshCache} />
      </DashboardControls>

      {details && openRow !== undefined && <DetailPanel details={details(openRow)} onClose={closeDetails} />}
    </>
  );
}
