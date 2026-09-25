import { MagazineMaterialsDashboard } from "@/components/ceo/MagazineMaterialsDashboard";
import { cacheKeys } from "@/lib/cache";
import { loadCeoTracker } from "@/lib/ceo/cached-load";
import { today } from "@/lib/ceo/week";
import {
  EMPTY_MAGAZINE_MATERIALS,
  loadMagazineMaterials,
  type MagazineMaterials,
} from "@/lib/ceo-magazine/materials";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Magazine Materials Tracker — CMG Dashboard" };

export default async function CeoMagazineMaterialsPage() {
  // Read through the cache; a failed read falls back to the last good figures, and
  // with none saved yet, to an empty board that says so rather than a crash.
  let data: MagazineMaterials = EMPTY_MAGAZINE_MATERIALS;
  let staleSince: string | null = null;
  try {
    ({ value: data, staleSince } = await loadCeoTracker(
      cacheKeys.ceoMagazineMaterials(today()),
      "ceo-magazine:v3",
      loadMagazineMaterials,
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-magazine] sheet unreadable:", err);
    data = { ...EMPTY_MAGAZINE_MATERIALS, warnings: [`Could not read the magazine-materials sheet: ${message}`] };
  }

  return <MagazineMaterialsDashboard data={data} live={data.source === "sheet"} staleSince={staleSince} />;
}
