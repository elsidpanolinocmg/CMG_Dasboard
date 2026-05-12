import { NextRequest, NextResponse } from "next/server";
import * as brandsRepo from "@/lib/repos/brands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const dept = decodeURIComponent(slug).toLowerCase();
    const brands = await brandsRepo.findByDepartment(dept);
    const map: Record<string, { url?: string; name: string }> = {};
    for (const b of brands) {
      if (!b.active) continue;
      map[b.slug] = { url: b.url, name: b.displayName };
    }
    return NextResponse.json(map, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/brands/by-department] handler error:", err);
    return NextResponse.json(
      {},
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Brand-Api-Error": (err as Error).message?.slice(0, 200) ?? "unknown",
        },
      },
    );
  }
}
