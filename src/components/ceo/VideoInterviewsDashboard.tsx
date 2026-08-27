import { Oswald } from "next/font/google";
import ViewportFit from "@/components/ViewportFit";
import styles from "./ceo-dashboard.module.css";
import { VideoInterviewsBody } from "./VideoInterviewsRotator";
import type { VideoInterviews } from "@/lib/ceo-video-interviews/interviews";

// Oswald for the condensed title/KPI numbers. Body text is Inter, supplied as
// --font-body by the CEO layout and applied through the panel's base font.
const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface VideoInterviewsDashboardProps {
  data: VideoInterviews;
  live: boolean;
}

/**
 * Award-video-interview production progress: a summary tile row, then a completion
 * bar per campaign split into two groups — in production (work outstanding) and
 * completed (every interview published). Shares the CEO white theme.
 */
export function VideoInterviewsDashboard({ data, live }: VideoInterviewsDashboardProps) {
  const { inProduction, completed, totalInterviews, totalDone, totalCampaigns, statusLegend } = data;
  const pctDone = totalInterviews ? Math.round((totalDone / totalInterviews) * 100) : 0;
  const outstanding = totalInterviews - totalDone;

  const subtitle = ["2026", live ? null : "No sheet connected — no figures available."].filter(Boolean).join(" · ");

  return (
    <section className={`${styles.panel} ${titleFont.variable}`} data-fullscreen="true" data-sfv="true">
      <ViewportFit />

      <header className={`${styles.masthead} ${styles.delivHeaderCard}`}>
        <div className={styles.delivTitleBlock}>
          <h1>Video Interview Progress Tracker</h1>
          <div className={styles.week}>{subtitle}</div>
        </div>
        <div className={styles.delivTiles}>
          <div className={styles.delivTile}>
            <div className={styles.delivTileValue}>{totalInterviews}</div>
            <div className={styles.delivTileLabel}>Interviews</div>
          </div>
          <div className={styles.delivTile}>
            <div className={styles.delivTileValue}>{pctDone}%</div>
            <div className={styles.delivTileLabel}>
              Complete · {totalDone}/{totalInterviews}
            </div>
          </div>
          <div className={styles.delivTile}>
            <div className={styles.delivTileValue}>{outstanding}</div>
            <div className={styles.delivTileLabel}>In Production</div>
          </div>
          <div className={styles.delivTile}>
            <div className={styles.delivTileValue}>{totalCampaigns}</div>
            <div className={styles.delivTileLabel}>Campaigns</div>
          </div>
        </div>
      </header>

      <VideoInterviewsBody inProduction={inProduction} completed={completed} statusLegend={statusLegend} />
    </section>
  );
}
