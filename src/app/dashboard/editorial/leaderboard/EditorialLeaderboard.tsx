"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardControls from "@/components/DashboardControls";
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
const TOP_STORIES = 3;

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

  const [pageSize, setPageSize] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 4 : 6,
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(60_000);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

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
  const fontSize = `clamp(0.85rem, min(calc(0.6vw + ${7 / eff}vw), ${rowHeightVh * 0.32}vh), 3.2rem)`;
  const headerSize = `clamp(0.7rem, min(calc(0.4vw + ${4.5 / eff}vw), ${rowHeightVh * 0.2}vh), 1.6rem)`;
  const storySize = `clamp(0.8rem, min(calc(0.45vw + ${5.5 / eff}vw), ${rowHeightVh * 0.22}vh), 1.7rem)`;
  const totalBigSize = `clamp(1.2rem, calc(0.7vw + ${8 / eff}vw), 3.2rem)`;
  const totalSummarySize = `clamp(0.65rem, calc(0.3vw + ${3 / eff}vw), 1.1rem)`;
  const chipSize = `clamp(0.7rem, min(calc(0.35vw + ${3.5 / eff}vw), ${rowHeightVh * 0.18}vh), 1.3rem)`;

  return (
    <div
      className="flex flex-col justify-center h-screen px-0 md:px-6 overflow-hidden"
      style={{ backgroundColor: "#ffffff" }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const diff = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(diff) > 50) {
          if (diff < 0) setPageIndex((i) => Math.min(totalPages - 1, i + 1));
          else setPageIndex((i) => Math.max(0, i - 1));
        }
        touchStartX.current = null;
      }}
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
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize }}>
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
              const stories = a ? a.articles.slice(0, TOP_STORIES) : [];
              return (
                <tr
                  key={a ? a.authorName : `empty-${idx}`}
                  style={{
                    height: `${rowHeightVh}vh`,
                    minHeight: "60px",
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
                  <td className="px-3 py-2 align-middle">
                    {a && (
                      <div className="flex flex-col gap-1">
                        <span
                          className="font-semibold leading-tight uppercase flex items-baseline gap-2"
                          style={{ color: "#111827", letterSpacing: "0.04em" }}
                          title={a.authorName}
                        >
                          {firstName(a.authorName)}
                          <span
                            className="font-normal normal-case tracking-normal"
                            style={{ color: "#6b7280", fontSize: "0.7em" }}
                          >
                            · {a.articles.length}{" "}
                            {a.articles.length === 1 ? "article" : "articles"}
                          </span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {a.brands.map((b) => (
                            <span
                              key={b}
                              className="inline-block uppercase font-semibold tracking-wider"
                              style={{
                                fontSize: chipSize,
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
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {a && (
                      <div className="flex flex-col gap-1">
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
                                padding: "0 8px",
                                borderRadius: "9999px",
                                minWidth: "3.5em",
                                fontSize: "0.7em",
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
                              {s.views.toLocaleString()}
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
                    {a ? a.totalViews.toLocaleString() : ""}
                  </td>
                </tr>
              );
            })}
            <tr
              style={{
                height: `${rowHeightVh}vh`,
                minHeight: "50px",
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
                {grandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex md:hidden landscape-hide flex-col flex-1 min-h-0">
        <table
          className="w-full border-collapse table-fixed h-full"
          style={{ fontSize: `clamp(0.7rem, calc(0.8vw + ${6 / eff}vw), 2rem)` }}
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
              const stories = a ? a.articles.slice(0, TOP_STORIES) : [];
              return (
                <tr
                  key={a ? `m-${a.authorName}` : `m-empty-${idx}`}
                  style={{
                    height: `${rowHeightVh}vh`,
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
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1">
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
                              · {a.articles.length}
                            </span>
                          </span>
                          {a.brands.slice(0, 3).map((b) => (
                            <span
                              key={b}
                              className="uppercase font-semibold tracking-wider"
                              style={{
                                fontSize: "0.8em",
                                background: CHIP_BG,
                                color: BRAND_NAVY,
                                border: `1px solid ${ROW_BORDER}`,
                                padding: "1px 8px",
                                borderRadius: "9999px",
                              }}
                            >
                              {b}
                            </span>
                          ))}
                        </div>
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
                              {s.views.toLocaleString()}
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
                    {a ? a.totalViews.toLocaleString() : ""}
                  </td>
                </tr>
              );
            })}
            <tr
              style={{
                height: `${rowHeightVh}vh`,
                minHeight: "44px",
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
                {grandTotal.toLocaleString()}
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
    </div>
  );
}
