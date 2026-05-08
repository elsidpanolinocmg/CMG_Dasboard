"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DashboardControls from "@/components/DashboardControls";
import BirthdaySlide, { type BirthdaySlideEntry } from "@/components/BirthdaySlide";

export interface BizzconEvent {
  id: string;
  brand: string;
  title: string;
  eventDate: string;
  link: string;
  image?: string;
  city?: string | null;
  venue?: string | null;
  registrationUrl?: string | null;
}

interface Props {
  events: BizzconEvent[];
  birthdays?: BirthdaySlideEntry[];
}

function daysUntil(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "ENDED";
  return `${Math.ceil(diff / 86400000)}`;
}

function isEventUrgent(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return false;
  return Math.ceil(diff / 86400000) < 30;
}

function daysColor(value: string): string {
  if (value === "ENDED") return "#ff1744";
  const days = parseInt(value, 10);
  if (isNaN(days)) return "#ffffff";
  if (days > 60) return "#00e676";
  if (days > 30) return "#ffd60a";
  return "#ff1744";
}

const PAGE_OPTIONS = [5, 6, 8, 12];
const ROTATION_OPTIONS = [
  { label: "Pause", value: 0 },
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

export default function BizzconGridClient({ events, birthdays = [] }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(5);
  const [pageIndex, setPageIndex] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(60_000);
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [birthdayShownIdx, setBirthdayShownIdx] = useState<number | null>(null);
  const birthdayCursor = useRef(0);
  const regularTicks = useRef(0);

  useEffect(() => {
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
      setPageSize(6);
    }
  }, []);

  const upcomingEvents = useMemo(() => {
    const filtered = events.filter((e) => new Date(e.eventDate) > new Date());
    const seen = new Set<string>();
    return filtered.filter((e) => {
      const key = `${e.title.toLowerCase().trim()}|${(e.city || "").toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

  const totalPages = Math.max(1, Math.ceil(upcomingEvents.length / pageSize));
  const displayed = upcomingEvents.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const rows: (BizzconEvent | null)[] = [...displayed];
  while (rows.length < pageSize) rows.push(null);

  const count = pageSize || 1;
  const eff = Math.min(count, 12);
  const rowHeight = Math.floor(80 / eff);
  const fontSize =
    eff <= 6
      ? `clamp(1rem, calc(0.8vw + ${9.5 / eff}vw), 6rem)`
      : `clamp(0.9rem, calc(0.6vw + ${7 / eff}vw), 2.8rem)`;
  const headerSize =
    eff <= 6
      ? `clamp(0.9rem, calc(0.55vw + ${5.5 / eff}vw), 3.8rem)`
      : `clamp(0.75rem, calc(0.4vw + ${4 / eff}vw), 2rem)`;
  const imgSize =
    eff <= 6
      ? Math.max(88, Math.min(320, 1050 / eff))
      : Math.max(72, Math.min(280, 980 / eff));
  const mFontSize =
    eff <= 6
      ? `clamp(0.95rem, calc(1.15vw + ${11.5 / eff}vw), 6rem)`
      : `clamp(0.85rem, calc(0.85vw + ${8 / eff}vw), 2.8rem)`;
  const mHeaderSize =
    eff <= 6
      ? `clamp(0.8rem, calc(0.8vw + ${7 / eff}vw), 3.8rem)`
      : `clamp(0.7rem, calc(0.55vw + ${5 / eff}vw), 2rem)`;
  const mImgSize = Math.max(32, Math.min(130, 420 / eff));

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

  return (
    <div
      className="relative flex flex-col justify-center h-screen pt-4 pb-8 px-0 md:px-4 overflow-hidden"
      style={{ backgroundColor: "#181818" }}
      ref={tableRef}
      onTouchStart={(e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (touchStart.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) setPageIndex((i) => Math.min(totalPages - 1, i + 1));
          else setPageIndex((i) => Math.max(0, i - 1));
        }
        touchStart.current = null;
      }}
    >
      <div className="hidden md:flex landscape-show flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white/90"
              style={{ fontSize: headerSize, backgroundColor: "#242424", letterSpacing: "0.12em" }}
            >
              <th className="px-2 py-3 w-[14%]"></th>
              <th className="pl-0 pr-3 py-3 w-[46%] text-left">Event Name</th>
              <th className="px-3 py-3 w-[24%]">City</th>
              <th className="px-3 py-3 w-[16%]">Days to Event</th>
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
            {rows.map((evt, idx) => (
              <tr
                key={evt ? evt.id || idx : `e-${idx}`}
                className="text-center uppercase"
                style={{
                  height: `${rowHeight}vh`,
                  maxHeight: `${rowHeight}vh`,
                  background:
                    idx % 2 === 0
                      ? "linear-gradient(90deg, #4A4A4A, #505050)"
                      : "linear-gradient(90deg, #73787C, #7A7F83)",
                  color: "#ffffff",
                  borderBottom: "0.5px solid #222",
                }}
              >
                <td className="px-2 py-1" style={{ height: `${rowHeight}vh` }}>
                  <div
                    className="flex items-center justify-center mx-auto h-full"
                    style={{ maxWidth: imgSize, maxHeight: `${rowHeight}vh` }}
                  >
                    {evt?.image && (
                      <Image
                        src={evt.image}
                        alt={evt.title}
                        width={imgSize}
                        height={imgSize}
                        className="object-contain rounded"
                        style={{ maxWidth: "100%", maxHeight: "100%" }}
                        unoptimized
                      />
                    )}
                  </div>
                </td>
                <td className="pl-0 pr-2 py-1 text-left" style={{ fontWeight: 300 }}>
                  {evt && (
                    <span
                      className="line-clamp-2"
                      style={{ lineHeight: 1.15 }}
                      dangerouslySetInnerHTML={{ __html: evt.title }}
                    />
                  )}
                </td>
                <td className="px-2 py-1" style={{ fontWeight: 300 }}>
                  {evt?.city || ""}
                </td>
                <td className="px-2 py-1 font-mono font-bold" style={{ fontSize: "1.5em" }}>
                  {evt &&
                    (() => {
                      const v = daysUntil(evt.eventDate);
                      const c = daysColor(v);
                      return (
                        <span
                          className={isEventUrgent(evt.eventDate) ? "animate-flash" : ""}
                          style={{
                            color: c,
                            textShadow: `1px 2px 3px rgba(0,0,0,0.4), 0 0 8px ${c}40, 0 0 20px ${c}20`,
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

      <div className="flex md:hidden landscape-hide flex-col flex-1 min-h-0">
        <table className="w-full border-collapse table-fixed h-full" style={{ fontSize: mFontSize }}>
          <thead>
            <tr
              className="text-center font-semibold uppercase text-white/90"
              style={{ fontSize: mHeaderSize, backgroundColor: "#242424", letterSpacing: "0.12em" }}
            >
              <th className="px-1 py-2 w-[45%]">Event</th>
              <th className="px-1 py-2 w-[25%]">City</th>
              <th className="px-1 py-2 pr-4 w-[30%]">Days to Event</th>
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
            {rows.map((evt, idx) => (
              <tr
                key={evt ? evt.id || idx : `em-${idx}`}
                className="text-center uppercase"
                style={{
                  height: `${rowHeight}vh`,
                  maxHeight: `${rowHeight}vh`,
                  background:
                    idx % 2 === 0
                      ? "linear-gradient(90deg, #4A4A4A, #505050)"
                      : "linear-gradient(90deg, #73787C, #7A7F83)",
                  color: "#ffffff",
                  borderBottom: "0.5px solid #222",
                }}
              >
                <td className="px-1 py-1 text-center" style={{ fontWeight: 300 }}>
                  {evt && (
                    <div className="flex flex-col items-center gap-1">
                      {evt.image && (
                        <Image
                          src={evt.image}
                          alt={evt.title}
                          width={mImgSize * 2}
                          height={mImgSize}
                          className="object-contain rounded"
                          style={{ width: mImgSize * 2, height: mImgSize }}
                          unoptimized
                        />
                      )}
                      <span
                        className="line-clamp-2"
                        style={{ lineHeight: 1.15 }}
                        dangerouslySetInnerHTML={{ __html: evt.title }}
                      />
                    </div>
                  )}
                </td>
                <td className="px-1 py-1" style={{ fontWeight: 300 }}>
                  {evt?.city || ""}
                </td>
                <td className="px-1 py-1 pr-4 font-mono font-bold" style={{ fontSize: "1.5em" }}>
                  {evt &&
                    (() => {
                      const v = daysUntil(evt.eventDate);
                      const c = daysColor(v);
                      return (
                        <span
                          className={isEventUrgent(evt.eventDate) ? "animate-flash" : ""}
                          style={{
                            color: c,
                            textShadow: `1px 2px 3px rgba(0,0,0,0.4), 0 0 8px ${c}40, 0 0 20px ${c}20`,
                            fontSize: v === "ENDED" ? "0.75em" : undefined,
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
              {n} events
            </option>
          ))}
          <option value={upcomingEvents.length}>All ({upcomingEvents.length})</option>
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
            href="/dashboard/bizzcon/shorts"
            className="px-4 py-1 rounded bg-black/40 text-white hover:bg-black/60 text-center text-sm"
          >
            Shorts
          </Link>
          <Link
            href="/dashboard/bizzcon/videos"
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
