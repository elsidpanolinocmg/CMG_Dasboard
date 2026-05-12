"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import BirthdaySlide, { type BirthdaySlideEntry } from "@/components/BirthdaySlide";
import { useSwipeNav } from "@/lib/hooks/useSwipeNav";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export interface Award {
  id: string;
  brand: string;
  title: string;
  field_date: string;
  view_node: string;
  startDate?: string | null;
  endDate?: string | null;
  image?: string;
  city?: string | null;
  contactPerson?: string | null;
}

interface Props {
  awards: Award[];
  birthdays?: BirthdaySlideEntry[];
}

function daysUntil(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "ENDED";
  return `${Math.ceil(diff / 86400000)}`;
}

function nominationCloseDays(endDate?: string | null): string {
  if (!endDate) return "CLOSED";
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "CLOSED";
  return `${Math.ceil(diff / 86400000)}`;
}

function isNominationUrgent(endDate?: string | null): boolean {
  if (!endDate) return false;
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return false;
  return Math.ceil(diff / 86400000) < 30;
}

function daysColor(value: string): string {
  if (value === "ENDED" || value === "CLOSED") return "#ef4444";
  const days = parseInt(value, 10);
  if (isNaN(days)) return "#ffffff";
  if (days > 60) return "#22c55e";
  if (days > 30) return "#eab308";
  return "#ef4444";
}

const PAGE_OPTIONS = [5, 6, 8, 12];
const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

export default function AwardsGridClient({ awards, birthdays: birthdaysProp = [] }: Props) {
  const isMobile = useIsMobile();
  const birthdays = isMobile ? [] : birthdaysProp;
  const now = new Date();
  const tableRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(5);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(60_000);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [birthdayShownIdx, setBirthdayShownIdx] = useState<number | null>(null);
  const birthdayCursor = useRef(0);
  const regularTicks = useRef(0);

  // Phone-friendly page size after mount (avoids SSR/CSR hydration mismatch).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setPageSize(6);
    }
  }, []);

  const upcomingAwards = useMemo(
    () => awards.filter((a) => new Date(a.field_date) > now),
    [awards],
  );

  const totalPages = Math.max(1, Math.ceil(upcomingAwards.length / pageSize));
  const displayed = upcomingAwards.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const rows: (Award | null)[] = [...displayed];
  while (rows.length < pageSize) rows.push(null);

  const count = pageSize || 1;
  const eff = Math.min(count, 12);
  const rowHeight = Math.floor(70 / eff);
  const fontSize = `clamp(1.3rem, calc(0.8vw + ${7.5 / eff}vw), 4.5rem)`;
  const headerSize = `clamp(0.85rem, calc(0.5vw + ${4.5 / eff}vw), 3rem)`;
  const imgSize = Math.max(36, Math.min(160, 450 / eff));
  const mFontSize = `clamp(0.8rem, calc(1.2vw + ${9 / eff}vw), 4.5rem)`;
  const mHeaderSize = `clamp(0.65rem, calc(0.8vw + ${6 / eff}vw), 3rem)`;
  const mImgSize = Math.max(12, Math.min(60, 200 / eff));

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  useEffect(() => {
    if (rotationTimer.current) clearInterval(rotationTimer.current);
    if (rotationInterval <= 0) return;
    if (totalPages <= 1 && birthdays.length === 0) return;
    // Show birthday once every 5 regular pages; if there are fewer than 5 pages,
    // show once per full cycle.
    const BIRTHDAY_EVERY = 5;
    const interval =
      totalPages < BIRTHDAY_EVERY ? Math.max(1, totalPages) : BIRTHDAY_EVERY;
    rotationTimer.current = setInterval(() => {
      if (birthdayShownIdx !== null) {
        setBirthdayShownIdx(null);
        regularTicks.current = 0;
        if (totalPages > 1) setPageIndex((i) => (i + 1) % totalPages);
        return;
      }
      regularTicks.current += 1;
      if (birthdays.length > 0 && regularTicks.current >= interval) {
        const next = birthdayCursor.current % birthdays.length;
        birthdayCursor.current = next + 1;
        setBirthdayShownIdx(next);
      } else if (totalPages > 1) {
        setPageIndex((i) => (i + 1) % totalPages);
      }
    }, rotationInterval);
    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current);
    };
  }, [rotationInterval, totalPages, birthdays.length, birthdayShownIdx]);

  const activeBirthday =
    birthdayShownIdx !== null && birthdays[birthdayShownIdx]
      ? birthdays[birthdayShownIdx]
      : null;

  const swipe = useSwipeNav({
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    enabled: totalPages > 1,
  });

  return (
    <div
      className="relative flex flex-col justify-center h-screen pt-4 pb-8 px-0 md:px-4 overflow-hidden"
      style={{ backgroundColor: "#0a1628" }}
      ref={tableRef}
      {...swipe}
    >
      <div className="hidden md:flex landscape-show flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white"
              style={{ fontSize: headerSize, backgroundColor: "#1a3a6e", borderBottom: "6px solid #0a1628" }}
            >
              <th className="px-3 py-3 w-[8%]"></th>
              <th className="px-3 py-3 w-[36%] text-left">Award Name</th>
              <th className="px-3 py-3 w-[14%]">City</th>
              <th className="px-3 py-3 w-[14%]">PIC</th>
              <th className="px-3 py-3 w-[14%]">Days to Awards</th>
              <th className="px-3 py-3 w-[14%]">Nom. Close Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr
                key={a ? a.id || idx : `e-${idx}`}
                className="text-center uppercase"
                style={{
                  height: `${rowHeight}vh`,
                  maxHeight: "12vh",
                  backgroundColor: idx % 2 === 0 ? "#0f2247" : "#162d5a",
                  color: "#ffffff",
                  borderBottom: "1px solid #1a3a6e",
                }}
              >
                <td className="px-2 py-1">
                  {a?.image && (
                    <div className="flex items-center justify-center">
                      <Image
                        src={a.image}
                        alt={a.title}
                        width={imgSize * 2}
                        height={imgSize}
                        className="object-contain rounded bg-white"
                        style={{ height: imgSize, width: "auto", maxWidth: imgSize * 2 }}
                        unoptimized
                      />
                    </div>
                  )}
                </td>
                <td className="px-2 py-1 text-left">
                  {a && (
                    <span
                      className="line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: a.title }}
                    />
                  )}
                </td>
                <td className="px-2 py-1">{a?.city || ""}</td>
                <td className="px-2 py-1">{a?.contactPerson?.split(" ")[0] || ""}</td>
                <td className="px-2 py-1 font-mono font-bold" style={{ fontSize: "1.5em" }}>
                  {a &&
                    (() => {
                      const v = daysUntil(a.field_date);
                      return <span style={{ color: daysColor(v) }}>{v}</span>;
                    })()}
                </td>
                <td className="px-2 py-1 font-mono font-bold" style={{ fontSize: "1.5em" }}>
                  {a &&
                    (() => {
                      const v = nominationCloseDays(a.endDate);
                      return (
                        <span
                          className={isNominationUrgent(a.endDate) ? "animate-flash" : ""}
                          style={{ color: daysColor(v) }}
                        >
                          {v}
                        </span>
                      );
                    })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex md:hidden landscape-hide flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize: mFontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white"
              style={{ fontSize: mHeaderSize, backgroundColor: "#1a3a6e", borderBottom: "6px solid #0a1628" }}
            >
              <th className="px-1 py-2 w-[42%]">Award</th>
              <th className="px-1 py-2 w-[22%]">City / PIC</th>
              <th className="px-1 py-2 w-[18%]">Days to Awards</th>
              <th className="px-1 py-2 w-[18%]">Nom. Close Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr
                key={a ? a.id || idx : `em-${idx}`}
                className="text-center uppercase"
                style={{
                  height: `${rowHeight}vh`,
                  maxHeight: "12vh",
                  backgroundColor: idx % 2 === 0 ? "#0f2247" : "#162d5a",
                  color: "#ffffff",
                  borderBottom: "1px solid #1a3a6e",
                }}
              >
                <td className="px-1 py-1 text-center">
                  {a && (
                    <div className="flex flex-col items-center gap-1">
                      {a.image && (
                        <Image
                          src={a.image}
                          alt={a.title}
                          width={mImgSize * 2}
                          height={mImgSize}
                          className="object-contain rounded bg-white"
                          style={{ height: mImgSize, width: "auto", maxWidth: mImgSize * 2 }}
                          unoptimized
                        />
                      )}
                      <span className="line-clamp-2" dangerouslySetInnerHTML={{ __html: a.title }} />
                    </div>
                  )}
                </td>
                <td className="px-1 py-1">
                  {a && (
                    <div className="flex flex-col">
                      <span>{a.city || ""}</span>
                      {a.contactPerson && (
                        <span className="text-gray-400" style={{ fontSize: "0.85em" }}>
                          {a.contactPerson.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-1 py-1 font-mono font-bold" style={{ fontSize: "1.5em" }}>
                  {a &&
                    (() => {
                      const v = daysUntil(a.field_date);
                      return (
                        <span
                          style={{ color: daysColor(v), fontSize: v === "ENDED" ? "0.75em" : undefined }}
                        >
                          {v}
                        </span>
                      );
                    })()}
                </td>
                <td className="px-1 py-1 mr-4 font-mono font-bold" style={{ fontSize: "1.5em" }}>
                  {a &&
                    (() => {
                      const v = nominationCloseDays(a.endDate);
                      return (
                        <span
                          className={isNominationUrgent(a.endDate) ? "animate-flash" : ""}
                          style={{
                            color: daysColor(v),
                            fontSize: v === "CLOSED" ? "0.75em" : undefined,
                          }}
                        >
                          {v}
                        </span>
                      );
                    })()}
                </td>
              </tr>
            ))}
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
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          className="px-4 py-2 rounded bg-black/40 text-white hover:bg-black/60 [&>option]:bg-gray-800 [&>option]:text-white"
        >
          {PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} awards
            </option>
          ))}
          <option value={upcomingAwards.length}>All ({upcomingAwards.length})</option>
        </select>
        <span className="text-sm text-white/80">
          {pageIndex + 1} / {totalPages}
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
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <Link
            href="/dashboard/awards/shorts"
            className="px-4 py-1 rounded bg-black/40 text-white hover:bg-black/60 text-center text-sm"
          >
            Shorts
          </Link>
          <Link
            href="/dashboard/awards/videos"
            className="px-4 py-1 rounded bg-black/40 text-white hover:bg-black/60 text-center text-sm"
          >
            Videos
          </Link>
        </div>
      </DashboardControls>

      {activeBirthday && (
        <div className="absolute inset-0 z-30">
          <BirthdaySlide entry={activeBirthday} />
        </div>
      )}
    </div>
  );
}
