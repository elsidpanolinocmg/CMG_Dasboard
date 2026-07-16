import styles from "./ceo-dashboard.module.css";
import { bandWidths, percentOfScale, type Bullet } from "@/lib/ceo/bullet";
import type { Rag } from "@/lib/ceo/rag";

interface BulletChartProps {
  bullet: Bullet;
  rag: Rag;
  /** How to render the value and the reference. Leads are counts, not currency. */
  format: (value: number) => string;
}

/**
 * Built from HTML rather than SVG. The bullet is a set of nested bars sized in
 * percentages, so it stretches to any tile width without the non-uniform-scale
 * problems that come with stretching a viewBox — the rounded data-end stays
 * round and the marker stays the width it was drawn.
 *
 * The bands are chrome, not data: neutral greys stepped off the surface, so the
 * measure bar is the only thing carrying colour. Reversing that — loud bands,
 * quiet bar — is the classic way this chart gets ruined. The band furthest from
 * the surface marks the poor range, in either colour scheme.
 */
export function BulletChart({ bullet, rag, format }: BulletChartProps) {
  const valuePercent = percentOfScale(bullet.value, bullet);
  const referencePercent = percentOfScale(bullet.reference, bullet);

  // Keep the marker's caption inside the tile at either extreme.
  const anchor = referencePercent < 15 ? "start" : referencePercent > 85 ? "end" : "middle";
  const captionTransform =
    anchor === "start" ? "translateX(0)" : anchor === "end" ? "translateX(-100%)" : "translateX(-50%)";

  return (
    <div
      role="img"
      aria-label={`${format(bullet.value)} against ${bullet.referenceLabel} of ${format(bullet.reference)}`}
    >
      <div className={styles.bulletTrack}>
        {bandWidths(bullet).map(({ tone, width }) => (
          <div key={tone} className={styles.bulletBand} data-tone={tone} style={{ width: `${width}%` }} />
        ))}

        <div className={styles.bulletMeasure} data-rag={rag} style={{ width: `${valuePercent}%` }} />
        <div className={styles.bulletMarker} style={{ left: `${referencePercent}%` }} />
      </div>

      <div className={styles.bulletCaption}>
        <span style={{ left: `${referencePercent}%`, transform: captionTransform }}>
          {bullet.referenceLabel} {format(bullet.reference)}
        </span>
      </div>
    </div>
  );
}
