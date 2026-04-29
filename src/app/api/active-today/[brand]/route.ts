import { NextRequest, NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { findBySlug } from "@/lib/repos/brands";
import { fetchActiveToday } from "@/lib/sources/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand: rawBrand } = await params;
  const brand = decodeURIComponent(rawBrand).toLowerCase();
  const row = await findBySlug(brand);
  if (!row) return NextResponse.json({ error: "Unknown brand" }, { status: 404 });
  if (!row.ga4PropertyId) {
    return NextResponse.json({ brand, value: 0, note: "no ga4PropertyId on brand" });
  }
  const value = await getCache().getOrLoad(
    cacheKeys.activeWindow(brand, 0),
    () => fetchActiveToday(row.ga4PropertyId!, row.ga4Filter),
    { ttlMs: ttls.ACTIVE_WINDOW, staleMs: ttls.ACTIVE_WINDOW_STALE },
  );
  return NextResponse.json({ brand, value });
}
