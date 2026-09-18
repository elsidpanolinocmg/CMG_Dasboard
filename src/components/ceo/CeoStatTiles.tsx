"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ceo-dashboard.module.css";

/** Ease-out so the count decelerates into its final value. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts from 0 up to `target` over `duration` ms on mount. Honours reduced-motion
 * (and non-finite targets) by showing the final value immediately.
 */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setValue(Math.round(easeOut(t) * target));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    setValue(0);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}

export interface StatTileSpec {
  value: number;
  /** Appended after the (animated) number, e.g. "%". */
  suffix?: string;
  label: string;
  /** "overdue" tints the number with the critical colour. */
  state?: "overdue";
}

function CountTile({ value, suffix = "", label, state }: StatTileSpec) {
  const shown = useCountUp(value);
  return (
    <div className={styles.delivTile} data-state={state}>
      <div className={styles.delivTileValue}>
        {shown}
        {suffix}
      </div>
      <div className={styles.delivTileLabel}>{label}</div>
    </div>
  );
}

/** The masthead's summary figures, counting up on load. Shared by the CEO boards. */
export function CeoStatTiles({ tiles }: { tiles: StatTileSpec[] }) {
  return (
    <div className={styles.delivTiles}>
      {tiles.map((t, i) => (
        <CountTile key={i} {...t} />
      ))}
    </div>
  );
}
