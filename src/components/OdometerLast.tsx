"use client";

import { useEffect, useState } from "react";

interface Props {
  fetchUrl: string;
  field?: string;
  bold?: boolean;
  color?: string;
  intervalms?: number;
}

export default function OdometerLast({
  fetchUrl,
  field = "value",
  bold = false,
  color = "#010101",
  intervalms = 60_000,
}: Props) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${fetchUrl}?intervalms=${intervalms}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const v = typeof data[field] === "number" ? data[field] : data.value;
        if (!cancelled && typeof v === "number") setValue(v);
      } catch {}
    };
    load();
    const id = setInterval(load, intervalms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchUrl, intervalms, field]);

  const formatted = value.toLocaleString();
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
      {formatted.split("").map((ch, i) => (
        <span
          key={i}
          style={{ width: ch === "," ? "0.5ch" : "1ch", display: "inline-block" }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
