import styles from "./ceo-dashboard.module.css";
import { formatCompactUSD } from "@/lib/ceo-money/money";
import type { OverdueSeries, OverduePoint } from "@/lib/ceo-money/overdue-series";

/**
 * Overdue receivables across the year, as a line chart: this year to the viewed
 * day, the prior year as a faded overlay, and a horizontal target line.
 *
 * Pure SVG so it renders on the server with no client JavaScript. The plot
 * stretches to the card via `preserveAspectRatio="none"`; strokes are pinned
 * with `vector-effect` so they do not smear, and the end dot and target label
 * are HTML placed in percentages so they stay round and level under the scale.
 * The month axis is a plain flex row beneath the plot rather than SVG text, so
 * it stays legible however the card is sized.
 */

const W = 320;
const H = 150;
const PAD = { left: 4, right: 4, top: 10, bottom: 6 } as const;
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface OverdueChartProps {
  series: OverdueSeries;
}

export function OverdueChart({ series }: OverdueChartProps) {
  const max =
    Math.max(
      series.target,
      series.thisYearLead.value,
      series.priorYearLead.value,
      ...series.thisYear.map((p) => p.value),
      ...series.priorYear.map((p) => p.value),
      1,
    ) * 1.12;

  const x = (frac: number) => PAD.left + frac * PLOT_W;
  const y = (v: number) => PAD.top + (1 - v / max) * PLOT_H;

  const path = (points: OverduePoint[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.frac).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  const last = series.thisYear[series.thisYear.length - 1];
  const targetY = y(series.target);

  return (
    <div className={styles.overdueChart}>
      <div className={styles.overduePlot}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={
            `Overdue receivables over the last four months of ${series.thisYearLabel}, currently ${formatCompactUSD(series.current)}, ` +
            `against a target of ${formatCompactUSD(series.target)}; the same months of ${series.priorYearLabel} shown for comparison`
          }
        >
          <line
            x1={x(0)}
            x2={x(1)}
            y1={targetY}
            y2={targetY}
            stroke="var(--warning)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path([series.priorYearLead, ...series.priorYear])}
            fill="none"
            stroke="var(--axis)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path([series.thisYearLead, ...series.thisYear])}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* A marker at every month on the current-year line. The amounts live under
            the month names on the axis below, rather than floating over the plot. */}
        {series.thisYear.map((p, i) => (
          <span
            key={`p${i}`}
            className={styles.overduePoint}
            style={{ left: `${(x(p.frac) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
            aria-hidden="true"
          />
        ))}

        {last && (
          <span
            className={styles.overdueDot}
            style={{ left: `${(x(last.frac) / W) * 100}%`, top: `${(y(last.value) / H) * 100}%` }}
            aria-hidden="true"
          />
        )}

        <span className={styles.overdueTargetLabel} style={{ top: `${(targetY / H) * 100}%` }}>
          Target {formatCompactUSD(series.target)}
        </span>
      </div>

      <div className={styles.overdueAxis}>
        {series.thisYear.map((p, i) => (
          <span key={i} className={styles.overdueAxisCell}>
            <span className={styles.overdueAxisMonth}>{MONTHS[p.month - 1]}</span>
            <span className={styles.overdueAxisValue}>{formatCompactUSD(p.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
