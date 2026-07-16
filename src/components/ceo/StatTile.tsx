import { BulletChart } from "./BulletChart";
import styles from "./ceo-dashboard.module.css";
import type { Bullet } from "@/lib/ceo/bullet";
import type { Rag } from "@/lib/ceo/rag";

/** Colour never carries state alone: every tile pairs its hue with a glyph and a word. */
const GLYPH: Record<Rag, string> = {
  good: "●",
  warning: "▲",
  critical: "■",
  neutral: "–",
};

interface StatTileProps {
  label: string;
  value: string;
  rag: Rag;
  note: string;
  /** Short lines under the value: attainment, target, comparison. */
  subLines: string[];
  /** Where the value sits against its target. Absent when there is no target. */
  bullet: Bullet | null;
  /** Renders the bullet's own numbers. The tile's headline `value` is pre-formatted. */
  format: (value: number) => string;
  /** Smaller type and less padding, so several regions of tiles fit one screen. */
  compact?: boolean;
}

export function StatTile({ label, value, rag, note, subLines, bullet, format, compact = false }: StatTileProps) {
  return (
    <section
      className={styles.tile}
      data-rag={rag}
      data-compact={compact ? "true" : "false"}
      aria-label={`${label}: ${value}, ${note}`}
    >
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>

      <div className={styles.tileSub}>
        {subLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      {/* Where the value sits against its target: the one question a red tile begs. */}
      <div className={styles.tileBullet}>
        {bullet ? (
          <BulletChart bullet={bullet} rag={rag} format={format} />
        ) : (
          <span className={styles.bulletAbsent}>No target set</span>
        )}
      </div>

      <div className={styles.tileFoot}>
        <span className={styles.badge} data-rag={rag}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.glyph} aria-hidden="true">
            {GLYPH[rag]}
          </span>
          {note}
        </span>
      </div>
    </section>
  );
}
