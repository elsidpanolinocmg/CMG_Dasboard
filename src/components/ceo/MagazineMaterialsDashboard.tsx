import { Oswald } from "next/font/google";
import ViewportFit from "@/components/ViewportFit";
import styles from "./ceo-dashboard.module.css";
import { MagazineMaterialsBody } from "./MagazineMaterialsRotator";
import { CeoStatTiles } from "./CeoStatTiles";
import type { MagazineMaterials } from "@/lib/ceo-magazine/materials";

const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface MagazineMaterialsDashboardProps {
  data: MagazineMaterials;
  live: boolean;
}

/** An ISO timestamp as a short Singapore-time label, e.g. "7 Sep 2026, 3:42 PM". */
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
 * 2026 magazine materials against their deadlines. A summary tile row, then a
 * completion bar per magazine brand split into two groups — overdue (a past-deadline
 * material still outstanding) and on track (deadline ahead). Shares the CEO theme.
 */
export function MagazineMaterialsDashboard({ data, live }: MagazineMaterialsDashboardProps) {
  const { overdue, onTrack, totalMaterials, totalDone, totalOverdue, totalBrands, statusLegend, updatedAt } = data;
  const pctDone = totalMaterials ? Math.round((totalDone / totalMaterials) * 100) : 0;

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
          <h1>Magazine Materials Tracker</h1>
          <div className={styles.week}>{subtitle}</div>
        </div>
        <CeoStatTiles
          tiles={[
            { value: totalMaterials, label: "Materials" },
            { value: pctDone, suffix: "%", label: `Done · ${totalDone}/${totalMaterials}` },
            { value: totalOverdue, label: "Past Deadline", state: "overdue" },
            { value: totalBrands, label: "Magazines" },
          ]}
        />
      </header>

      <MagazineMaterialsBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </section>
  );
}
