import { ShortFormVideosDashboard } from "@/components/ceo/ShortFormVideosDashboard";
import { cacheKeys } from "@/lib/cache";
import { loadCeoTracker } from "@/lib/ceo/cached-load";
import { today } from "@/lib/ceo/week";
import { EMPTY_SHORT_FORM_VIDEOS, loadShortFormVideos, type ShortFormVideos } from "@/lib/ceo-sfv/sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Short Form Videos — CMG Dashboard" };

export default async function CeoShortFormVideosPage() {
  // Read through the cache; a failed read falls back to the last good figures, and
  // with none saved yet, to an empty board that says so rather than a crash.
  let data: ShortFormVideos = EMPTY_SHORT_FORM_VIDEOS;
  let staleSince: string | null = null;
  try {
    ({ value: data, staleSince } = await loadCeoTracker(
      cacheKeys.ceoShortFormVideos(today()),
      "ceo-sfv:v3",
      loadShortFormVideos,
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-sfv] sheet unreadable:", err);
    data = { ...EMPTY_SHORT_FORM_VIDEOS, warnings: [`Could not read the Short Form Videos sheet: ${message}`] };
  }

  return <ShortFormVideosDashboard data={data} live={data.source === "sheet"} staleSince={staleSince} />;
}
