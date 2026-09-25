import { CeoBoardShell } from "./CeoBoardShell";
import { DeliverablesBody } from "./ClientDeliverablesRotator";
import type { ClientDeliverables } from "@/lib/ceo-deliverables/deliverables";

export interface ClientDeliverablesDashboardProps {
  data: ClientDeliverables;
  live: boolean;
  /** Set when the sheet couldn't be read and saved figures are shown. */
  staleSince?: string | null;
}

/**
 * Client deliverables against their campaign deadlines. A summary tile row, then
 * a completion bar per campaign split into two groups — overdue (past deadline)
 * and on track (deadline ahead). Shares the CEO white theme.
 */
export function ClientDeliverablesDashboard({ data, live, staleSince }: ClientDeliverablesDashboardProps) {
  const { overdue, onTrack, totalOverdue, totalDone, totalDeliverables, statusLegend, updatedAt } = data;
  const pctDone = totalDeliverables ? Math.round((totalDone / totalDeliverables) * 100) : 0;

  return (
    <CeoBoardShell
      title="PRs & Interviews"
      period="2026"
      updatedAt={updatedAt}
      staleSince={staleSince}
      live={live}
      notes={data.warnings}
      tiles={[
        { value: totalOverdue, label: "Overdue Deliverables", state: "overdue" },
        { value: pctDone, suffix: "%", label: `Published · ${totalDone}/${totalDeliverables}` },
        { value: overdue.length, label: "Campaigns Behind" },
      ]}
    >
      <DeliverablesBody overdue={overdue} onTrack={onTrack} statusLegend={statusLegend} />
    </CeoBoardShell>
  );
}
