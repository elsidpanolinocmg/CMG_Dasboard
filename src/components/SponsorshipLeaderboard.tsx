"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardControls from "@/components/DashboardControls";
import ViewportFit from "@/components/ViewportFit";

const REFRESH_MS = 30 * 60 * 1000;

type Cell = number | string | null;

type Week = {
  week: string;
  values: Record<string, Cell>;
  weeklyTotal: number;
  monthlyTotal: number | null;
};

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

type Payload = {
  salespeople: string[];
  weeks: Week[];
  totals: Record<string, number>;
  grandTotal: number;
  currentQuarter: Quarter;
  quarterTotals: Record<string, number>;
  lastUpdated: string;
};

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#ffffff";
}

interface Props {
  fetchUrl: string;
  backLabel: string;
  backHref: string;
}

export default function SponsorshipLeaderboard({ fetchUrl, backLabel, backHref }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationMs, setRotationMs] = useState(15_000);
  const cancelledRef = useRef(false);

  const load = useCallback(async (opts?: { fresh?: boolean }) => {
    setRefreshing(true);
    try {
      const url = opts?.fresh
        ? `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}fresh=1`
        : fetchUrl;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Payload;
      if (!cancelledRef.current) {
        setData(json);
        setError(null);
      }
    } catch (e) {
      if (!cancelledRef.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!cancelledRef.current) setRefreshing(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    cancelledRef.current = false;
    load();
    const id = setInterval(() => load(), REFRESH_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [load]);

  // Phone (portrait OR landscape) now only drives justify + the row min-height.
  // Root height and row heights are sized to the measured visible viewport
  // (--vvh / --lvh, published by <ViewportFit /> in the render) for ALL devices,
  // so the layout fits under Safari's toolbar/tab bar. (Previously phones pinned
  // the root with `position: fixed` + a measured height, but iOS resolves `fixed`
  // against the taller *layout* viewport, so with the tab bar shown the pinned
  // root ran past the visible area and clipped the bottom Total row.)
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (max-height: 600px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // Document scroll lock + the visible-height vars (--vvh / --lvh) that drive the
  // root and row heights are handled by <ViewportFit /> (mounted in the render),
  // so every device fits under Safari's toolbar/tab bar with no per-device path.

  const ranked = useMemo(() => {
    if (!data) return [];
    return data.salespeople
      .map((name) => ({
        name,
        total: data.totals[name] ?? 0,
        quarter: data.quarterTotals?.[name] ?? 0,
      }))
      .filter((r) => r.total > 0 || r.quarter > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const quarterGrandTotal = useMemo(() => {
    if (!data?.quarterTotals) return 0;
    return Object.values(data.quarterTotals).reduce((a, b) => a + b, 0);
  }, [data]);

  // Max 10 people per page; show only the real rows (no empty padding). With 10
  // or fewer there's a single page; beyond that it paginates and auto-rotates
  // like the other leaderboards.
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  useEffect(() => {
    if (totalPages <= 1 || rotationMs <= 0) return;
    const id = setInterval(() => setPageIndex((p) => (p + 1) % totalPages), rotationMs);
    return () => clearInterval(id);
  }, [totalPages, rotationMs]);

  if (error && !data) {
    return (
      <div
        className="flex items-center justify-center h-[100dvh] text-red-400 text-center px-6"
        style={{ backgroundColor: "#2a2a2a" }}
      >
        Failed to load: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="flex items-center justify-center h-[100dvh] text-white/70"
        style={{ backgroundColor: "#2a2a2a" }}
      >
        Loading...
      </div>
    );
  }

  const currentPage = Math.min(pageIndex, totalPages - 1);
  const displayed = ranked.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const rowCount = Math.max(displayed.length + 1, 1);
  const effectiveCount = Math.min(rowCount, 12);
  const rowHeightVh = 82 / rowCount;
  const fontSize = `clamp(0.85rem, min(calc(0.8vw + ${9 / effectiveCount}vw), ${rowHeightVh * 0.5}vh), 5rem)`;
  const headerSize = `clamp(0.7rem, min(calc(0.5vw + ${5 / effectiveCount}vw), ${rowHeightVh * 0.35}vh), 2.8rem)`;
  const mFontSize = `clamp(0.8rem, min(calc(1.2vw + ${9.5 / effectiveCount}vw), ${rowHeightVh * 0.5}vh), 4.5rem)`;
  const mHeaderSize = `clamp(0.65rem, min(calc(0.8vw + ${6 / effectiveCount}vw), ${rowHeightVh * 0.35}vh), 2.8rem)`;
  // Row height = a share of the REAL visible viewport: --lvh is 1% of it (from
  // <ViewportFit />), so the rows fit under Safari's toolbar/tab bar instead of
  // being budgeted off the taller `vh`/`dvh`. On phones drop the 40px min so a
  // short landscape viewport can shrink the rows enough to keep the Total in view.
  const tblRowH = `calc(${rowHeightVh} * var(--lvh, 1svh))`;
  const tblRowMin = isPhone ? "0px" : "40px";

  return (
    <div
      className={`flex flex-col px-0 md:px-4 overflow-hidden h-lvh ${
        isPhone ? "justify-start" : "justify-center"
      }`}
      style={{ backgroundColor: "#2a2a2a" }}
    >
      <ViewportFit />
      {/* ---- DESKTOP TABLE ---- */}
      <div className="hidden md:flex landscape-show flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white/90"
              style={{ fontSize: headerSize, backgroundColor: "#3a3a3a", letterSpacing: "0.12em" }}
            >
              <th className="px-2 py-3 w-[12%]">Rank</th>
              <th className="pl-0 pr-3 py-3 w-[40%] text-left">Person in Charge</th>
              <th className="px-3 py-3 w-[24%] text-right">Current Quarter</th>
              <th className="px-3 py-3 w-[24%] text-right">Total Sales</th>
            </tr>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: 0,
                  height: "2px",
                  background: "linear-gradient(90deg, #d4a853, transparent)",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, idx) => {
              const rank = currentPage * PAGE_SIZE + idx + 1;
              const color = rankColor(rank);
              return (
                <tr
                  key={row.name}
                  className="text-center uppercase"
                  style={{
                    height: tblRowH,
                    minHeight: tblRowMin,
                    background:
                      idx % 2 === 0
                        ? "linear-gradient(90deg, #4A4A4A, #505050)"
                        : "linear-gradient(90deg, #73787C, #7A7F83)",
                    color: "#ffffff",
                    borderBottom: "0.5px solid #222",
                  }}
                >
                  <td
                    className="px-2 py-1 font-mono font-bold"
                    style={{
                      color,
                      textShadow:
                        rank <= 3
                          ? `0 1px 3px rgba(0,0,0,0.8), 0 0 8px ${color}40, 0 0 20px ${color}20`
                          : "0 1px 3px rgba(0,0,0,0.8)",
                      fontSize: "1.3em",
                    }}
                  >
                    #{rank}
                  </td>
                  <td className="pl-0 pr-2 py-1 text-left" style={{ fontWeight: 300 }}>
                    {row.name}
                  </td>
                  <td
                    className="px-3 py-1 text-right font-mono font-bold"
                    style={{
                      color: row.quarter > 0 ? "#ffffff" : "#bbbbbb",
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {formatCurrency(row.quarter)}
                  </td>
                  <td
                    className="px-3 py-1 text-right font-mono font-bold"
                    style={{
                      color: row.total > 0 ? "#00ff88" : "#bbbbbb",
                      textShadow:
                        row.total > 0
                          ? "0 1px 3px rgba(0,0,0,0.8), 0 0 12px rgba(0,255,136,0.3)"
                          : "none",
                    }}
                  >
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              );
            })}
            <tr
              className="text-center uppercase"
              style={{
                height: tblRowH,
                minHeight: tblRowMin,
                background: "linear-gradient(90deg, #2a2a2a, #3a3020)",
                borderTop: "2px solid rgba(212, 168, 83, 0.6)",
                color: "#f0c668",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              <td className="px-2 py-1" />
              <td
                className="pl-0 pr-2 py-1 text-left font-semibold"
                style={{ letterSpacing: "0.12em" }}
              >
                Total
              </td>
              <td
                className="px-3 py-1 text-right font-mono font-bold"
                style={{
                  fontSize: "1.15em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 8px #d4a85340, 0 0 20px #d4a85320",
                }}
              >
                {formatCurrency(quarterGrandTotal)}
              </td>
              <td
                className="px-3 py-1 text-right font-mono font-bold"
                style={{
                  fontSize: "1.15em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 8px #d4a85340, 0 0 20px #d4a85320",
                }}
              >
                {formatCurrency(data.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- MOBILE TABLE ---- */}
      {/* Scrollable on phones: with many salespeople the rows hit their 40px floor
          and overflow the viewport, so let this column scroll instead of clipping
          the bottom rows. Desktop/TV keeps the fit-to-screen layout. */}
      <div className="flex md:hidden landscape-hide flex-col flex-1 min-h-0 overflow-y-auto">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize: mFontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white/90"
              style={{ fontSize: mHeaderSize, backgroundColor: "#3a3a3a", letterSpacing: "0.12em" }}
            >
              <th className="px-1 py-2 w-[14%]">Rank</th>
              <th className="px-1 py-2 w-[36%] text-left">PIC</th>
              <th className="px-1 py-2 w-[25%] text-right">Current Quarter</th>
              <th className="px-1 py-2 pr-3 w-[25%] text-right">Total</th>
            </tr>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: 0,
                  height: "2px",
                  background: "linear-gradient(90deg, #d4a853, transparent)",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, idx) => {
              const rank = currentPage * PAGE_SIZE + idx + 1;
              const color = rankColor(rank);
              return (
                <tr
                  key={row.name}
                  className="text-center uppercase"
                  style={{
                    height: tblRowH,
                    minHeight: tblRowMin,
                    background:
                      idx % 2 === 0
                        ? "linear-gradient(90deg, #4A4A4A, #505050)"
                        : "linear-gradient(90deg, #73787C, #7A7F83)",
                    color: "#ffffff",
                    borderBottom: "0.5px solid #222",
                  }}
                >
                  <td
                    className="px-1 py-1 font-mono font-bold"
                    style={{
                      color,
                      textShadow:
                        rank <= 3
                          ? `0 1px 3px rgba(0,0,0,0.8), 0 0 8px ${color}40, 0 0 20px ${color}20`
                          : "0 1px 3px rgba(0,0,0,0.8)",
                      fontSize: "1.25em",
                    }}
                  >
                    #{rank}
                  </td>
                  <td className="px-1 py-1 text-left" style={{ fontWeight: 300 }}>
                    {row.name}
                  </td>
                  <td
                    className="px-1 py-1 text-right font-mono font-bold"
                    style={{
                      color: row.quarter > 0 ? "#ffffff" : "#bbbbbb",
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {formatCurrency(row.quarter)}
                  </td>
                  <td
                    className="px-1 py-1 pr-3 text-right font-mono font-bold"
                    style={{
                      color: row.total > 0 ? "#00ff88" : "#bbbbbb",
                      textShadow:
                        row.total > 0
                          ? "0 1px 3px rgba(0,0,0,0.8), 0 0 12px rgba(0,255,136,0.3)"
                          : "none",
                    }}
                  >
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              );
            })}
            <tr
              className="text-center uppercase"
              style={{
                height: tblRowH,
                minHeight: tblRowMin,
                background: "linear-gradient(90deg, #2a2a2a, #3a3020)",
                borderTop: "2px solid rgba(212, 168, 83, 0.6)",
                color: "#f0c668",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              <td className="px-1 py-1" />
              <td
                className="px-1 py-1 text-left font-semibold"
                style={{ letterSpacing: "0.12em" }}
              >
                Total
              </td>
              <td
                className="px-1 py-1 text-right font-mono font-bold"
                style={{
                  fontSize: "1.1em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 8px #d4a85340, 0 0 20px #d4a85320",
                }}
              >
                {formatCurrency(quarterGrandTotal)}
              </td>
              <td
                className="px-1 py-1 pr-3 text-right font-mono font-bold"
                style={{
                  fontSize: "1.1em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 8px #d4a85340, 0 0 20px #d4a85320",
                }}
              >
                {formatCurrency(data.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <DashboardControls>
        <button
          onClick={() => load({ fresh: true })}
          disabled={refreshing}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
        <button
          onClick={() => setPageIndex((p) => (p - 1 + totalPages) % totalPages)}
          disabled={totalPages <= 1}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ◀ Prev
        </button>
        <span className="text-sm text-white/80">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPageIndex((p) => (p + 1) % totalPages)}
          disabled={totalPages <= 1}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next ▶
        </button>
        <select
          value={rotationMs}
          onChange={(e) => setRotationMs(Number(e.target.value))}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          <option value="0">No rotate</option>
          <option value="5000">5s</option>
          <option value="10000">10s</option>
          <option value="15000">15s</option>
          <option value="30000">30s</option>
          <option value="60000">60s</option>
        </select>
        <span className="text-xs text-white/70">
          {data ? `Updated ${new Date(data.lastUpdated).toLocaleTimeString()}` : ""}
        </span>
        <button
          onClick={() => (window.location.href = backHref)}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60"
        >
          {backLabel}
        </button>
      </DashboardControls>
    </div>
  );
}
