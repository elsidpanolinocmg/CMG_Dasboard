"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import ViewportFit from "@/components/ViewportFit";
import { useSwipeNav } from "@/lib/hooks/useSwipeNav";
import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import { formatCompactSGD } from "@/lib/ceo-money/money";
import type { AwardRow } from "@/lib/ceo-money/awards";

interface AccountLink {
  key: string;
  label: string;
  href: string;
}

export interface AwardsDashboardProps {
  awards: AwardRow[];
  /** The Fri–Thu week the figures cover. */
  weekText: string;
  pinned: boolean;
  live: boolean;
  warnings: string[];
  accounts: AccountLink[];
}

const PAGE_OPTIONS = [5, 8, 10];
const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

const CONTROL_BTN = "px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60";

/**
 * The 2026 awards as a fit-to-screen wallboard, paginated and auto-rotating like
 * /dashboard/awards, but wearing the CEO dashboard theme (surface, borders and
 * ink text, with RAG-coloured figures) rather than a hardcoded navy. One row per
 * award (accounts column F, pooled across regions): cash and revenue for the year,
 * and the 30+‑day overdue balance. No charts.
 */
export function AwardsDashboard({ awards, accounts }: AwardsDashboardProps) {
  const [pageSize, setPageSize] = useState(5);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(60_000);

  const totalPages = Math.max(1, Math.ceil(awards.length / pageSize));
  const displayed = awards.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const rows: (AwardRow | null)[] = [...displayed];
  while (rows.length < pageSize) rows.push(null);

  useEffect(() => {
    setPageIndex((i) => Math.min(i, Math.max(0, Math.ceil(awards.length / pageSize) - 1)));
  }, [pageSize, awards.length]);

  useEffect(() => {
    if (rotationInterval <= 0 || totalPages <= 1) return;
    const t = setInterval(() => setPageIndex((i) => (i + 1) % totalPages), rotationInterval);
    return () => clearInterval(t);
  }, [rotationInterval, totalPages]);

  const swipe = useSwipeNav({
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    enabled: totalPages > 1,
  });

  const eff = Math.min(Math.max(pageSize, 1), 12);
  const rowHeight = Math.floor(64 / eff);
  const fontSize = `clamp(1.25rem, calc(0.8vw + ${8 / eff}vw), 4.2rem)`;
  const headerSize = `clamp(0.85rem, calc(0.5vw + ${4.5 / eff}vw), 2.6rem)`;

  const money = (n: number) => (n === 0 ? "—" : formatCompactSGD(n));

  const numCell = (value: number, kind: "cash" | "revenue" | "overdue") => (
    <td className={styles.awNum} data-kind={kind} data-zero={value === 0 ? "true" : "false"}>
      {money(value)}
    </td>
  );

  return (
    <section className={styles.panel} data-fullscreen="true" data-awards="true" {...swipe}>
      <ViewportFit />

      <div className={styles.awardsTableWrap}>
        <table className={styles.awardsTable} style={{ fontSize }} data-rows={pageSize}>
          <thead>
            <tr style={{ fontSize: headerSize }}>
              <th className={styles.awColName}>Awards Name</th>
              <th>Cash collected</th>
              <th>Revenue closed</th>
              <th>Overdue receivables</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr key={a ? a.award : `e-${idx}`} style={{ height: `${rowHeight}vh`, maxHeight: "12vh" }}>
                <td className={styles.awName}>
                  {a && (
                    <>
                      <span className={styles.awNameText}>{a.award}</span>
                      <span className={styles.awCount}>
                        {a.count} invoice{a.count === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </td>
                {a ? numCell(a.cash, "cash") : <td />}
                {a ? numCell(a.revenue, "revenue") : <td />}
                {a ? numCell(a.overdue, "overdue") : <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DashboardControls>
        <Link href="/dashboard/ceo" className={CONTROL_BTN}>
          ← Back
        </Link>
        <button
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          className={`${CONTROL_BTN} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ◀ Prev
        </button>
        <span className="text-sm text-white/80">
          {pageIndex + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))}
          disabled={pageIndex >= totalPages - 1}
          className={`${CONTROL_BTN} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          Next ▶
        </button>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPageIndex(0);
          }}
          className={`${CONTROL_BTN} [&>option]:bg-gray-800 [&>option]:text-white`}
        >
          {PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} rows
            </option>
          ))}
        </select>
        <select
          value={rotationInterval}
          onChange={(e) => setRotationInterval(Number(e.target.value))}
          className={`${CONTROL_BTN} [&>option]:bg-gray-800 [&>option]:text-white`}
        >
          {ROTATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="hidden h-8 w-px bg-white/30 sm:block" aria-hidden="true" />
        {accounts
          .filter((a) => a.key !== "awards")
          .map((a) => (
            <Link key={a.key} href={a.href} className={CONTROL_BTN}>
              {a.label}
            </Link>
          ))}
        <RefreshButton className={`${CONTROL_BTN} disabled:opacity-60`} />
      </DashboardControls>
    </section>
  );
}
