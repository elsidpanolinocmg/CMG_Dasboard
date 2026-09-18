import { MagazineMaterialsDashboard } from "@/components/ceo/MagazineMaterialsDashboard";
import { loadMagazineMaterials, type MagazineMaterials } from "@/lib/ceo-magazine/materials";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "Magazine Materials Tracker — CMG Dashboard" };

export default async function CeoMagazineMaterialsPage() {
  // A failed read degrades to an empty board with a caveat rather than a crash.
  let data: MagazineMaterials = {
    overdue: [],
    onTrack: [],
    totalMaterials: 0,
    totalDone: 0,
    totalOverdue: 0,
    totalBrands: 0,
    statusLegend: [],
    updatedAt: null,
    source: "none",
    warnings: [],
  };
  try {
    data = await loadMagazineMaterials();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ceo-magazine] sheet unreadable:", err);
    data = { ...data, warnings: [`Could not read the magazine-materials sheet: ${message}`] };
  }

  return <MagazineMaterialsDashboard data={data} live={data.source === "sheet"} />;
}
