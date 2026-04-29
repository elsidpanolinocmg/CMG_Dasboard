"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OdometerProps {
  fetchUrl: string;
  intervalMs?: number;
  bold?: boolean;
  className?: string;
}

interface ApiShape {
  value?: number;
  total?: number;
  activeUsers?: number;
}

export default function Odometer({
  fetchUrl,
  intervalMs = 60_000,
  bold = false,
  className = "",
}: OdometerProps) {
  const [targetValue, setTargetValue] = useState<number>(0);
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [initialFetched, setInitialFetched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(fetchUrl, { cache: "no-store" });
        const data = (await res.json()) as ApiShape;
        const v =
          typeof data.value === "number"
            ? data.value
            : typeof data.total === "number"
              ? data.total
              : typeof data.activeUsers === "number"
                ? data.activeUsers
                : null;
        if (cancelled || v === null) return;
        setTargetValue(v);
        if (!initialFetched) {
          setDisplayValue(v);
          setInitialFetched(true);
        }
      } catch {
        // ignore transient fetch failures
      }
    }
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchUrl, intervalMs, initialFetched]);

  useEffect(() => {
    if (!initialFetched || displayValue === targetValue) return;
    const step = displayValue < targetValue ? 1 : -1;
    // Speed up large gaps so we don't crawl forever.
    const gap = Math.abs(targetValue - displayValue);
    const tickMs = gap > 200 ? 8 : gap > 50 ? 16 : 30;
    const id = setInterval(() => {
      setDisplayValue((v) => (v === targetValue ? v : v + step));
    }, tickMs);
    return () => clearInterval(id);
  }, [displayValue, targetValue, initialFetched]);

  const padded = displayValue.toString().padStart(targetValue.toString().length, "0");

  return (
    <div
      className={className}
      style={{
        display: "flex",
        fontWeight: bold ? 700 : 400,
        lineHeight: 1,
      }}
    >
      {padded.split("").map((digit, i) => (
        <span
          key={i}
          style={{
            position: "relative",
            width: "1ch",
            overflow: "hidden",
            display: "inline-block",
          }}
        >
          <AnimatePresence initial={false}>
            <motion.span
              key={digit + i}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </div>
  );
}
