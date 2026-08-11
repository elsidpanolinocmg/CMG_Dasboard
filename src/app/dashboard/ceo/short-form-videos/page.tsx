import { ShortFormVideosDashboard } from "@/components/ceo/ShortFormVideosDashboard";
import { loadShortFormVideos, type ShortFormVideos } from "@/lib/ceo-sfv/sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Short Form Videos — CMG Dashboard" };

export default async function CeoShortFormVideosPage() {
  // A failed read degrades to an empty board with a caveat rather than a crash.
  let data: ShortFormVideos = { statuses: [], total: 0, lastUpdated: null, source: "none", warnings: [] };
  try {
    data = await loadShortFormVideos();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-sfv] sheet unreadable:", err);
    data = { ...data, warnings: [`Could not read the Short Form Videos sheet: ${message}`] };
  }

  return <ShortFormVideosDashboard data={data} live={data.source === "sheet"} />;
}
