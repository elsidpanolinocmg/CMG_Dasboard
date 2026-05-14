"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import { useSwipeNav } from "@/lib/hooks/useSwipeNav";
import { MAILCHIMP_WINDOW_OPTIONS } from "../windowDays";
import type { CampaignWindowStats } from "@/lib/sources/mailchimpTypes";

const MC_BLACK = "#000000";
const MC_YELLOW = "#FFE01B";
const MC_INK = "#1a1a1a";
const MC_MUTED = "#6b6b6b";
const MC_RED = "#9b1c1c";
const ALT_ROW_BG = "#fafafa";
const ROW_BORDER = "#e5e5e5";

const PAGE_OPTIONS = [4, 6, 8, 10];
const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

interface Props {
  rows: CampaignWindowStats[];
  grandTotals: {
    campaigns: number;
    sends: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number | null;
    clickRate: number | null;
    ctor: number | null;
  };
  windowDays: number;
}

function fmt(n: number): string {
  return n.toLocaleString();
}
function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}
function fmtCount(v: number, hasSends: boolean): string {
  if (!hasSends) return "—";
  return fmt(v);
}

export default function MailchimpReportsClient({ rows, grandTotals, windowDays }: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [pageSize, setPageSize] = useState<number>(6);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(60_000);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phone-friendly page size after mount (avoids SSR/CSR hydration mismatch).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setPageSize(4);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const displayed = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const padded: (CampaignWindowStats | null)[] = [...displayed];
  while (padded.length < pageSize) padded.push(null);

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

  // Auto-refresh — server re-reads cache on router.refresh.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  const swipe = useSwipeNav({
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    enabled: totalPages > 1,
  });

  function handleRefresh() {
    startRefresh(() => {
      router.replace(
        `/dashboard/mailchimp/reports?cache=clear&days=${windowDays}&t=${Date.now()}`,
      );
    });
  }

  function handleWindowChange(nextDays: number) {
    if (nextDays === windowDays) return;
    startRefresh(() => {
      router.replace(`/dashboard/mailchimp/reports?days=${nextDays}`);
    });
  }

  // Sizing — same clamp family as the audience leaderboard.
  const count = pageSize || 1;
  const eff = Math.min(count + 1, 12);
  const rowHeightVh = 70 / (count + 1);
  const fontSize = `clamp(0.8rem, min(calc(0.55vw + ${6 / eff}vw), ${rowHeightVh * 0.3}vh), 2.6rem)`;
  const headerSize = `clamp(0.65rem, min(calc(0.35vw + ${4 / eff}vw), ${rowHeightVh * 0.18}vh), 1.4rem)`;
  const totalBigSize = `clamp(1rem, calc(0.6vw + ${7 / eff}vw), 2.6rem)`;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#ffffff", color: MC_INK }}
      {...swipe}
    >
      {/* ---- DESKTOP / TABLET TABLE ---- */}
      <div className="hidden md:flex flex-1 min-h-0 px-0 md:px-6 flex-col">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize }}>
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
              <th className="px-3 sm:px-4 py-3 w-[24%]">Audience</th>
              <th className="px-2 py-3 w-[8%] text-right">Campaigns</th>
              <th className="px-2 py-3 w-[12%] text-right">Sends</th>
              <th className="px-2 py-3 w-[11%] text-right">Opens</th>
              <th className="px-2 py-3 w-[9%] text-right">Open %</th>
              <th className="px-2 py-3 w-[11%] text-right">Clicks</th>
              <th className="px-2 py-3 w-[9%] text-right">Click %</th>
              <th className="px-3 sm:px-4 py-3 w-[16%] text-right">CTOR</th>
            </tr>
            <tr>
              <td colSpan={8} style={{ padding: 0, height: 3, background: MC_YELLOW }} />
            </tr>
          </thead>
          <tbody>
            {padded.map((row, idx) => (
              <DesktopRow key={row ? row.listId : `e-${idx}`} row={row} idx={idx} rowHeightVh={rowHeightVh} />
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
              <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
                {fmt(grandTotals.campaigns)}
              </td>
              <td
                className="px-2 py-2 text-right font-mono font-bold align-middle tabular-nums"
                style={{ color: MC_BLACK, fontSize: totalBigSize }}
              >
                {fmt(grandTotals.sends)}
              </td>
              <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
                {fmt(grandTotals.uniqueOpens)}
              </td>
              <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
                {fmtPct(grandTotals.openRate)}
              </td>
              <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
                {fmt(grandTotals.uniqueClicks)}
              </td>
              <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
                {fmtPct(grandTotals.clickRate)}
              </td>
              <td
                className="px-3 sm:px-4 py-2 text-right font-mono font-bold align-middle tabular-nums"
                style={{ color: MC_BLACK, fontSize: totalBigSize }}
              >
                {fmtPct(grandTotals.ctor)}
              </td>
            </tr>
          </tbody>
        </table>
        <div
          className="px-3 sm:px-4 py-2 text-sm italic"
          style={{ color: MC_MUTED }}
        >
          Open % excludes Apple Mail auto-opens, matching Mailchimp&apos;s dashboard.
        </div>
      </div>

      {/* ---- MOBILE CARDS ---- */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col px-3 pt-2 pb-[140px]">
        <div className="flex-1 min-h-0 grid auto-rows-fr gap-2">
          {displayed.map((row) => (
            <MobileCard key={row.listId} row={row} />
          ))}
        </div>
        <div
          className="mt-2 shrink-0 rounded-lg px-2 py-1.5"
          style={{ background: ALT_ROW_BG, border: `1.5px solid ${MC_YELLOW}` }}
        >
          <div className="grid grid-cols-4 gap-x-2 gap-y-1">
            <TotalCell label="Campaigns" value={fmt(grandTotals.campaigns)} />
            <TotalCell label="Sends" value={fmt(grandTotals.sends)} bold />
            <TotalCell label="Opens" value={fmt(grandTotals.uniqueOpens)} />
            <TotalCell label="Clicks" value={fmt(grandTotals.uniqueClicks)} />
            <TotalCell label="Open %" value={fmtPct(grandTotals.openRate)} bold />
            <TotalCell label="Click %" value={fmtPct(grandTotals.clickRate)} bold />
            <TotalCell label="CTOR" value={fmtPct(grandTotals.ctor)} bold />
          </div>
        </div>
        <div className="mt-2 text-xs leading-snug italic" style={{ color: MC_MUTED }}>
          Open % excludes Apple Mail auto-opens.
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
            setPageIndex(0);
          }}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {PAGE_OPTIONS.map((n) => (
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
          {ROTATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Rotate · {opt.label}
            </option>
          ))}
        </select>
        <select
          value={windowDays}
          onChange={(e) => handleWindowChange(Number(e.target.value))}
          disabled={isRefreshing}
          title="Date range — campaigns sent in the last N days"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-50 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {MAILCHIMP_WINDOW_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Window · last {d} days
            </option>
          ))}
        </select>
        <Link
          href="/dashboard/mailchimp"
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          Audiences →
        </Link>
      </DashboardControls>
    </div>
  );
}

function DesktopRow({
  row,
  idx,
  rowHeightVh,
}: {
  row: CampaignWindowStats | null;
  idx: number;
  rowHeightVh: number;
}) {
  const hasSends = !!row && row.sends > 0;
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
          <div className="flex flex-col gap-0.5">
            <span
              className="font-bold uppercase leading-tight"
              style={{ color: MC_BLACK, letterSpacing: "0.04em" }}
              title={row.title}
            >
              {row.title}
            </span>
            {row.error && (
              <span className="text-xs" style={{ color: MC_RED }}>
                Error: {row.error}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
        {row ? fmt(row.campaignsCount) : ""}
      </td>
      <td
        className="px-2 py-2 text-right font-mono font-bold align-middle tabular-nums"
        style={{ color: MC_BLACK, fontSize: "1.2em" }}
      >
        {row ? fmtCount(row.sends, hasSends) : ""}
      </td>
      <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
        {row ? fmtCount(row.uniqueOpens, hasSends) : ""}
      </td>
      <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
        {row ? fmtPct(row.openRate) : ""}
      </td>
      <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
        {row ? fmtCount(row.uniqueClicks, hasSends) : ""}
      </td>
      <td className="px-2 py-2 text-right font-mono align-middle tabular-nums" style={{ color: MC_INK }}>
        {row ? fmtPct(row.clickRate) : ""}
      </td>
      <td
        className="px-3 sm:px-4 py-2 text-right font-mono font-bold align-middle tabular-nums"
        style={{ color: MC_BLACK, fontSize: "1.15em" }}
      >
        {row ? fmtPct(row.ctor) : ""}
      </td>
    </tr>
  );
}

function MobileCard({ row }: { row: CampaignWindowStats }) {
  const hasSends = row.sends > 0;
  return (
    <div
      className="rounded-lg p-2.5 h-full min-h-0 overflow-hidden flex flex-col justify-between"
      style={{
        background: "#ffffff",
        border: `1px solid ${ROW_BORDER}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span
          className="font-bold uppercase leading-tight flex-1 min-w-0 break-words"
          style={{ color: MC_BLACK, letterSpacing: "0.04em", fontSize: "0.95rem" }}
        >
          {row.title}
        </span>
        <span className="shrink-0 text-xs" style={{ color: MC_MUTED }}>
          {row.campaignsCount} campaigns
        </span>
      </div>
      {row.error ? (
        <div className="text-xs" style={{ color: MC_RED }}>
          {row.error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
            <Metric label="Sends" value={fmtCount(row.sends, hasSends)} bold />
            <Metric label="Opens" value={fmtCount(row.uniqueOpens, hasSends)} />
            <Metric label="Clicks" value={fmtCount(row.uniqueClicks, hasSends)} />
          </div>
          <div
            className="grid grid-cols-3 gap-2 text-xs pt-2"
            style={{ borderTop: `1px dashed ${ROW_BORDER}` }}
          >
            <Metric label="Open %" value={fmtPct(row.openRate)} bold />
            <Metric label="Click %" value={fmtPct(row.clickRate)} bold />
            <Metric label="CTOR" value={fmtPct(row.ctor)} bold />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="uppercase tracking-wider" style={{ color: MC_MUTED, fontSize: "0.6rem" }}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${bold ? "font-bold" : ""}`}
        style={{ color: MC_INK, fontSize: "0.85rem" }}
      >
        {value}
      </span>
    </div>
  );
}

function TotalCell({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
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
        style={{ color: MC_BLACK, fontSize: "0.78rem" }}
      >
        {value}
      </span>
    </div>
  );
}
