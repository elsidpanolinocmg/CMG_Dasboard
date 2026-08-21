import { Oswald } from "next/font/google";
import ViewportFit from "@/components/ViewportFit";
import styles from "./ceo-dashboard.module.css";
import { DeliverablesBody } from "./ClientDeliverablesRotator";
import type { ClientDeliverables } from "@/lib/ceo-deliverables/deliverables";

const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface ClientDeliverablesDashboardProps {
  data: ClientDeliverables;
  live: boolean;
}

/**
 * Client deliverables against their campaign deadlines. A summary tile row, then
 * a completion bar per campaign split into two groups — overdue (past deadline)
 * and on track (deadline ahead). Shares the CEO white theme.
 */
export function ClientDeliverablesDashboard({ data, live }: ClientDeliverablesDashboardProps) {
  const { overdue, onTrack, totalOverdue, totalDone, totalDeliverables, statusLegend } = data;
  const pctDone = totalDeliverables ? Math.round((totalDone / totalDeliverables) * 100) : 0;

  const subtitle = ["2026", live ? null : "No sheet connected — no figures available."].filter(Boolean).join(" · ");

  return (
    <section className={`${styles.panel} ${titleFont.variable}`} data-fullscreen="true" data-sfv="true">
      <ViewportFit />

      <header className={`${styles.masthead} ${styles.delivHeaderCard}`}>
        <div>
          <h1>Client Deliverables Overdue</h1>
          <div className={styles.week}>{subtitle}</div>
        </div>
        <div className={styles.delivTiles}>
          <div className={styles.delivTile} data-state="overdue">
            <div className={styles.delivTileValue}>{totalOverdue}</div>
            <div className={styles.delivTileLabel}>Overdue</div>
          </div>
          <div className={styles.delivTile}>
            <div className={styles.delivTileValue}>{pctDone}%</div>
            <div className={styles.delivTileLabel}>
              Done · {totalDone}/{totalDeliverables}
            </div>
          </div>
          <div className={styles.delivTile}>
            <div className={styles.delivTileValue}>{overdue.length}</div>
            <div className={styles.delivTileLabel}>Behind</div>
          </div>
        </div>
      </header>

      <DeliverablesBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </section>
  );
}
