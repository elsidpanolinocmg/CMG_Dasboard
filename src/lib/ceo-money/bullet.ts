import { ascendingBullet, descendingBullet } from "@/lib/ceo/bullet";
import type { Bullet } from "@/lib/ceo/bullet";
import type { ArMetric, DashboardConfig, OverdueMetric, TargetMetric } from "./types";

export type { Band, BandTone, Bullet } from "@/lib/ceo/bullet";
export { bandWidths, percentOfScale } from "@/lib/ceo/bullet";

/** Headroom past the reference, so a value on target is not pinned to the edge. */
const TARGET_HEADROOM = 1.25;
const AR_HEADROOM = 1.35;

/**
 * Cash and revenue: more is better. The marker is the *paced* target, matching
 * what the tile's percentage is measured against — not the full week's target.
 */
export function buildTargetBullet(metric: TargetMetric, config: DashboardConfig): Bullet | null {
  if (metric.pacedTarget === null) return null;

  return ascendingBullet({
    value: metric.actual,
    reference: metric.pacedTarget,
    referenceLabel: "pace",
    amberAt: config.targetAmberAt,
    greenAt: config.targetGreenAt,
    headroom: TARGET_HEADROOM,
  });
}

/**
 * Overdue receivables as a progress-to-zero gauge.
 *
 * The goal is to have none of the outstanding cash sitting overdue, so the gauge
 * fills with the *clear* share — the outstanding that is still within terms.
 * A full bar means nothing is overdue; the bar drains as overdue grows. More
 * fill is better, so this reads like the cash and revenue bullets rather than
 * against them, and a CEO does not have to remember that "less is better" for
 * this one tile.
 *
 * The scale is fixed at 0–100%, not headroomed to the value, because a gauge
 * whose "empty" and "full" move around cannot be read at a glance. The marker is
 * the green line — the share that must be clear to stay out of yellow.
 */
export function buildOverdueGauge(metric: OverdueMetric, config: DashboardConfig): Bullet | null {
  if (metric.ratio === null) return null;

  const clear = Math.max(0, Math.min(1, 1 - metric.ratio));
  const greenLine = 1 - config.overdueGreenAt; // e.g. 70% clear to be green
  const amberFloor = 1 - config.overdueAmberAt; // e.g. 50% clear to avoid red

  return {
    value: clear,
    reference: greenLine,
    referenceLabel: "target clear",
    scaleMax: 1,
    // More fill is better: poor at the empty end, good at the full end.
    bands: [
      { upTo: amberFloor, tone: "poor" },
      { upTo: greenLine, tone: "fair" },
      { upTo: 1, tone: "good" },
    ],
  };
}

/**
 * Overdue receivables against their own trailing average. Retained for the
 * sample-data path, which has no register to compute a billing base from.
 */
export function buildArBullet(metric: ArMetric, config: DashboardConfig): Bullet | null {
  if (metric.trailingAverage === null) return null;

  return descendingBullet({
    value: metric.actual,
    reference: metric.trailingAverage,
    referenceLabel: "4-week average",
    warnAt: 1 + config.arWarningGrowth,
    critAt: 1 + config.arCriticalGrowth,
    headroom: AR_HEADROOM,
  });
}
