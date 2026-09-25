import { CeoBoardShell } from "./CeoBoardShell";
import { MagazineMaterialsBody } from "./MagazineMaterialsRotator";
import type { MagazineMaterials } from "@/lib/ceo-magazine/materials";

export interface MagazineMaterialsDashboardProps {
  data: MagazineMaterials;
  live: boolean;
  /** Set when the sheet couldn't be read and saved figures are shown. */
  staleSince?: string | null;
}

/**
 * 2026 magazine materials against their deadlines. A summary tile row, then a
 * completion bar per magazine brand split into two groups — overdue (a past-deadline
 * material still outstanding) and on track (deadline ahead). Shares the CEO theme.
 */
export function MagazineMaterialsDashboard({ data, live, staleSince }: MagazineMaterialsDashboardProps) {
  const { overdue, onTrack, totalMaterials, totalDone, totalOverdue, totalBrands, statusLegend, updatedAt } = data;
  const pctDone = totalMaterials ? Math.round((totalDone / totalMaterials) * 100) : 0;

  return (
    <CeoBoardShell
      title="Magazine Materials Tracker"
      period="2026"
      updatedAt={updatedAt}
      staleSince={staleSince}
      live={live}
      notes={data.warnings}
      tiles={[
        { value: totalMaterials, label: "Materials" },
        { value: pctDone, suffix: "%", label: `Done · ${totalDone}/${totalMaterials}` },
        { value: totalOverdue, label: "Past Deadline", state: "overdue" },
        { value: totalBrands, label: "Magazines" },
      ]}
    >
      <MagazineMaterialsBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </CeoBoardShell>
  );
}
