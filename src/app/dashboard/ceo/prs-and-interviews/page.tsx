import { ClientDeliverablesDashboard } from "@/components/ceo/ClientDeliverablesDashboard";
import { cacheKeys } from "@/lib/cache";
import { loadCeoTracker } from "@/lib/ceo/cached-load";
import { today } from "@/lib/ceo/week";
import {
  EMPTY_CLIENT_DELIVERABLES,
  loadClientDeliverables,
  type ClientDeliverables,
} from "@/lib/ceo-deliverables/deliverables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "PRs & Interviews — CMG Dashboard" };

export default async function CeoClientDeliverablesPage() {
  // Read through the cache; a failed read falls back to the last good figures, and
  // with none saved yet, to an empty board that says so rather than a crash.
  let data: ClientDeliverables = EMPTY_CLIENT_DELIVERABLES;
  let staleSince: string | null = null;
  try {
    ({ value: data, staleSince } = await loadCeoTracker(
      cacheKeys.ceoDeliverables(today()),
      "ceo-deliverables:v3",
      loadClientDeliverables,
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-deliverables] sheet unreadable:", err);
    data = { ...EMPTY_CLIENT_DELIVERABLES, warnings: [`Could not read the client-deliverables sheet: ${message}`] };
  }

  return <ClientDeliverablesDashboard data={data} live={data.source === "sheet"} staleSince={staleSince} />;
}
