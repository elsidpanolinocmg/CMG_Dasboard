"use client";

import { useEffect, useState } from "react";

interface Props {
  fetchUrl: string;
  field?: string;
  bold?: boolean;
  color?: string;
}

export default function OdometerDaily({
  fetchUrl,
  field = "value",
  bold = false,
  color = "#010101",
}: Props) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(0);
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(fetchUrl, { cache: "no-store" });
        const data = await res.json();
        const v = typeof data[field] === "number" ? data[field] : data.value;
        if (!cancelled && typeof v === "number") setValue(v);
      } catch {}
    };
    load();

    const now = new Date();
    const nextNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    if (now >= nextNoon) nextNoon.setDate(nextNoon.getDate() + 1);
    const wait = nextNoon.getTime() - now.getTime();
    let dailyId: ReturnType<typeof setInterval> | null = null;
    const noonId = setTimeout(() => {
      load();
      dailyId = setInterval(load, 24 * 60 * 60 * 1000);
    }, wait);
    return () => {
      cancelled = true;
      clearTimeout(noonId);
      if (dailyId) clearInterval(dailyId);
    };
  }, [fetchUrl, field]);

  return (
    <div
      style={{
        display: "flex",
        fontWeight: bold ? "bold" : "normal",
        fontSize: "clamp(20px, 2vw, 40px)",
        color,
        lineHeight: 1,
      }}
    >
      {value.toLocaleString()}
    </div>
  );
}
