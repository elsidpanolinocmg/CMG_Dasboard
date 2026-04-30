import { NextRequest, NextResponse } from "next/server";
import * as brandsRepo from "@/lib/repos/brands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
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
}
