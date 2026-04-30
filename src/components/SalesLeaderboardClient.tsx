"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DashboardControls from "@/components/DashboardControls";

const REFRESH_MS = 30 * 60 * 1000;

interface Entry {
  name: string;
  total: number;
  deals: number;
  topAward: string;
}

interface Payload {
  entries: Entry[];
  grandTotal: number;
  lastUpdated: string;
}

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

export default function SalesLeaderboardClient({ fetchUrl, backLabel, backHref }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number | "all">(10);
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

  const entryCount = data?.entries.length ?? 0;
  const effectivePageSize = pageSize === "all" ? Math.max(1, entryCount) : pageSize;
  const totalPagesForRotation = Math.max(1, Math.ceil(entryCount / effectivePageSize));
  useEffect(() => {
    setPageIndex(0);
  }, [pageSize]);
  useEffect(() => {
    if (totalPagesForRotation <= 1 || rotationMs <= 0) return;
    const id = setInterval(() => {
      setPageIndex((p) => (p + 1) % totalPagesForRotation);
    }, rotationMs);
    return () => clearInterval(id);
  }, [totalPagesForRotation, rotationMs]);

  if (error && !data) {
    return (
      <div
        className="flex items-center justify-center h-screen text-red-400 text-center px-6"
        style={{ backgroundColor: "#2a2a2a" }}
      >
        Failed to load: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div
        className="flex items-center justify-center h-screen text-white/70"
        style={{ backgroundColor: "#2a2a2a" }}
      >
        Loading...
      </div>
    );
  }

  const entries = data.entries;
  const resolvedPageSize = pageSize === "all" ? Math.max(1, entries.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(entries.length / resolvedPageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const displayed = entries.slice(currentPage * resolvedPageSize, (currentPage + 1) * resolvedPageSize);
  const padCount = Math.max(0, resolvedPageSize - displayed.length);
  const rowCount = resolvedPageSize + 2;
  const eff = Math.min(rowCount, 12);
  const rowHeightVh = 92 / rowCount;
  const fontSize = `clamp(1rem, min(calc(1vw + ${11 / eff}vw), ${rowHeightVh * 0.55}vh), 5rem)`;
  const headerSize = `clamp(0.85rem, min(calc(0.6vw + ${6 / eff}vw), ${rowHeightVh * 0.42}vh), 3rem)`;
  const mFontSize = `clamp(0.95rem, min(calc(1.4vw + ${11 / eff}vw), ${rowHeightVh * 0.55}vh), 4.5rem)`;
  const mHeaderSize = `clamp(0.8rem, min(calc(1vw + ${7 / eff}vw), ${rowHeightVh * 0.42}vh), 2.8rem)`;

  return (
    <div
      className="flex flex-col justify-center h-screen px-0 md:px-4 overflow-hidden"
      style={{ backgroundColor: "#2a2a2a" }}
    >
      <div className="hidden md:flex landscape-show flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white/90"
              style={{ fontSize: headerSize, backgroundColor: "#3a3a3a", letterSpacing: "0.12em" }}
            >
              <th className="px-2 py-3 w-[14%]">Rank</th>
              <th className="pl-0 pr-3 py-3 w-[56%] text-left">Person in Charge</th>
              <th className="px-3 py-3 w-[30%] text-right">Total Sales</th>
            </tr>
            <tr>
              <td
                colSpan={3}
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
              const rank = currentPage * resolvedPageSize + idx + 1;
              const color = rankColor(rank);
              return (
                <tr
                  key={row.name}
                  className="text-center uppercase"
                  style={{
                    height: `${rowHeightVh}vh`,
                    minHeight: "40px",
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
            {Array.from({ length: padCount }).map((_, i) => {
              const idx = displayed.length + i;
              return (
                <tr
                  key={`pad-d-${i}`}
                  style={{
                    height: `${rowHeightVh}vh`,
                    minHeight: "40px",
                    background:
                      idx % 2 === 0
                        ? "linear-gradient(90deg, #4A4A4A, #505050)"
                        : "linear-gradient(90deg, #73787C, #7A7F83)",
                    borderBottom: "0.5px solid #222",
                  }}
                >
                  <td colSpan={3} />
                </tr>
              );
            })}
            <tr
              className="text-center uppercase"
              style={{
                height: `${rowHeightVh}vh`,
                minHeight: "40px",
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
                {formatCurrency(data.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex md:hidden landscape-hide flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize: mFontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white/90"
              style={{ fontSize: mHeaderSize, backgroundColor: "#3a3a3a", letterSpacing: "0.12em" }}
            >
              <th className="px-1 py-2 w-[16%]">Rank</th>
              <th className="px-1 py-2 w-[50%] text-left">Person</th>
              <th className="px-1 py-2 pr-3 w-[34%] text-right">Total</th>
            </tr>
            <tr>
              <td
                colSpan={3}
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
              const rank = currentPage * resolvedPageSize + idx + 1;
              const color = rankColor(rank);
              return (
                <tr
                  key={row.name}
                  className="text-center uppercase"
                  style={{
                    height: `${rowHeightVh}vh`,
                    minHeight: "40px",
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
            {Array.from({ length: padCount }).map((_, i) => {
              const idx = displayed.length + i;
              return (
                <tr
                  key={`pad-m-${i}`}
                  style={{
                    height: `${rowHeightVh}vh`,
                    minHeight: "40px",
                    background:
                      idx % 2 === 0
                        ? "linear-gradient(90deg, #4A4A4A, #505050)"
                        : "linear-gradient(90deg, #73787C, #7A7F83)",
                    borderBottom: "0.5px solid #222",
                  }}
                >
                  <td colSpan={3} />
                </tr>
              );
            })}
            <tr
              className="text-center uppercase"
              style={{
                height: `${rowHeightVh}vh`,
                minHeight: "40px",
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
        <select
          value={pageSize === "all" ? "all" : String(pageSize)}
          onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          <option value="10">10 / page</option>
          <option value="20">20 / page</option>
          <option value="all">All</option>
        </select>
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
