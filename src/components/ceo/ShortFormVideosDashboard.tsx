import Link from "next/link";
import { Oswald } from "next/font/google";
import DashboardControls from "@/components/DashboardControls";
import ViewportFit from "@/components/ViewportFit";
import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import type { ShortFormVideos } from "@/lib/ceo-sfv/sheet";

const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface ShortFormVideosDashboardProps {
  data: ShortFormVideos;
  live: boolean;
}

/**
 * The short-form-video pipeline as a fit-to-screen wallboard: a big total, then a
 * horizontal bar per status (longest first), sharing the CEO white theme.
 */
export function ShortFormVideosDashboard({ data, live }: ShortFormVideosDashboardProps) {
  const { statuses, total, lastUpdated } = data;
  const max = statuses.reduce((m, s) => Math.max(m, s.count), 0) || 1;

  const subtitle = [
    "2026",
    lastUpdated ? `Last updated ${lastUpdated}` : null,
    live ? null : "No sheet connected — no figures available.",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className={`${styles.panel} ${titleFont.variable}`}
      data-fullscreen="true"
      data-sfv="true"
    >
      <ViewportFit />

      <header className={styles.masthead}>
        <div>
          <h1>Short Form Videos</h1>
          <div className={styles.week}>{subtitle}</div>
        </div>
      </header>

      <div className={styles.sfvBody}>
        <div className={styles.sfvTotal}>
          <div className={styles.sfvTotalValue}>{total}</div>
          <div className={styles.sfvTotalLabel}>Total videos</div>
        </div>

        <div className={styles.sfvBars} role="img" aria-label={`Videos by status, ${total} in total`}>
          {statuses.map((s) => (
            <div key={s.status} className={styles.sfvBarRow}>
              <span className={styles.sfvBarLabel}>{s.status}</span>
              <div className={styles.sfvBarTrack}>
                <div className={styles.sfvBarFill} style={{ width: `${(s.count / max) * 100}%` }} />
              </div>
              <span className={styles.sfvBarValue}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <DashboardControls>
        <Link
          href="/dashboard/ceo"
          className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70"
        >
          ← Back
        </Link>
        <RefreshButton className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70 disabled:opacity-60" />
      </DashboardControls>
    </section>
  );
}
