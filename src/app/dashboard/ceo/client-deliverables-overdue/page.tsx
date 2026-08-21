import { ClientDeliverablesDashboard } from "@/components/ceo/ClientDeliverablesDashboard";
import { loadClientDeliverables, type ClientDeliverables } from "@/lib/ceo-deliverables/deliverables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Client Deliverables Overdue — CMG Dashboard" };

export default async function CeoClientDeliverablesPage() {
  // A failed read degrades to an empty board with a caveat rather than a crash.
  let data: ClientDeliverables = {
    overdue: [],
    onTrack: [],
    totalOverdue: 0,
    totalDone: 0,
    totalDeliverables: 0,
    totalPastDeadline: 0,
    statusLegend: [],
    source: "none",
    warnings: [],
  };
  try {
    data = await loadClientDeliverables();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-deliverables] sheet unreadable:", err);
    data = { ...data, warnings: [`Could not read the client-deliverables sheet: ${message}`] };
  }

  return <ClientDeliverablesDashboard data={data} live={data.source === "sheet"} />;
}
