import { CeoBoardShell } from "./CeoBoardShell";
import { ShortFormVideosBody } from "./ShortFormVideosRotator";
import type { ShortFormVideos } from "@/lib/ceo-sfv/sheet";

export interface ShortFormVideosDashboardProps {
  data: ShortFormVideos;
  live: boolean;
  /** Set when the sheet couldn't be read and saved figures are shown. */
  staleSince?: string | null;
}

/**
 * Short-form-video progress by awards programme against the deadlines logged in the
 * sheet: a summary tile row, then a card per award split into two groups — overdue (a
 * video past its deadline, or none logged) and on track. Mirrors the PRs board.
 */
export function ShortFormVideosDashboard({ data, live, staleSince }: ShortFormVideosDashboardProps) {
  const { overdue, onTrack, totalVideos, totalDone, totalOverdue, statusLegend, updatedAt } = data;
  const pctDone = totalVideos ? Math.round((totalDone / totalVideos) * 100) : 0;

  return (
    <CeoBoardShell
      title="Short Form Videos"
      period="2026"
      updatedAt={updatedAt}
      staleSince={staleSince}
      live={live}
      notes={data.warnings}
      tiles={[
        { value: totalOverdue, label: "Overdue Videos", state: "overdue" },
        { value: pctDone, suffix: "%", label: `Sent · ${totalDone}/${totalVideos}` },
        { value: totalVideos - totalDone, label: "In Production" },
        { value: overdue.length, label: "Needs Attention" },
      ]}
    >
      <ShortFormVideosBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </CeoBoardShell>
  );
}
