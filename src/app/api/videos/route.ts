import { NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { fetchVimeoVideos } from "@/lib/sources/vimeo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await getCache().getOrLoad(
    cacheKeys.videosAll(),
    () => fetchVimeoVideos(undefined, 300),
    { ttlMs: ttls.VIDEOS, staleMs: ttls.VIDEOS_STALE },
  );
  return NextResponse.json({ videos });
}
