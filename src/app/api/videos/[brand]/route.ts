import { NextRequest, NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { fetchVimeoVideosByBrand } from "@/lib/sources/vimeo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand: rawBrand } = await params;
  const brand = decodeURIComponent(rawBrand).toLowerCase();
  const videos = await getCache().getOrLoad(
    cacheKeys.videosByBrand(brand),
    () => fetchVimeoVideosByBrand(brand, 300),
    { ttlMs: ttls.VIDEOS, staleMs: ttls.VIDEOS_STALE },
  );
  return NextResponse.json({ brand, videos });
}
