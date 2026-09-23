import { Oswald } from "next/font/google";
import ViewportFit from "@/components/ViewportFit";
import styles from "./ceo-dashboard.module.css";
import { CeoStatTiles } from "./CeoStatTiles";
import { ShortFormVideosBody } from "./ShortFormVideosRotator";
import type { ShortFormVideos } from "@/lib/ceo-sfv/sheet";

// Oswald for the condensed title/KPI numbers. Body text is Inter, supplied as
// --font-body by the CEO layout and applied through the panel's base font.
const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface ShortFormVideosDashboardProps {
  data: ShortFormVideos;
  live: boolean;
}

/** An ISO timestamp as a short Singapore-time label, e.g. "23 Sep 2026, 4:39 pm". */
function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Short-form-video progress by awards programme against the deadlines logged in the
 * sheet: a summary tile row, then a card per award split into two groups — overdue (a
 * video past its deadline and not yet sent) and on track. Mirrors the PRs board.
 */
export function ShortFormVideosDashboard({ data, live }: ShortFormVideosDashboardProps) {
  const { overdue, onTrack, totalVideos, totalDone, totalOverdue, statusLegend, updatedAt } = data;
  const pctDone = totalVideos ? Math.round((totalDone / totalVideos) * 100) : 0;

  const subtitle = [
    "2026",
    updatedAt ? `Updated ${formatUpdated(updatedAt)}` : null,
    live ? null : "No sheet connected — no figures available.",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={`${styles.panel} ${titleFont.variable}`} data-fullscreen="true" data-sfv="true">
      <ViewportFit />

      <header className={`${styles.masthead} ${styles.delivHeaderCard}`}>
        <div className={styles.delivTitleBlock}>
          <h1>Short Form Videos</h1>
          <div className={styles.week}>{subtitle}</div>
        </div>
        <CeoStatTiles
          tiles={[
            { value: totalOverdue, label: "Overdue Videos", state: "overdue" },
            { value: pctDone, suffix: "%", label: `Sent · ${totalDone}/${totalVideos}` },
            { value: totalVideos - totalDone, label: "In Production" },
            { value: overdue.length, label: "Needs Attention" },
          ]}
        />
      </header>

      <ShortFormVideosBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </section>
  );
}
