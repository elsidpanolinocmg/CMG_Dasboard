import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Tells the browser whether its country should use the video backup instead of
// Vimeo (Vimeo is blocked by ISPs in some countries, e.g. Indonesia).
// Country comes from Vercel's geo header; the list is the BACKUP_COUNTRIES env
// var (comma-separated ISO codes, default "ID"), so adding a country needs no code.
export function GET(req: NextRequest) {
  const country = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
  const list = (process.env.BACKUP_COUNTRIES || "ID")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return NextResponse.json(
    { country, fallback: !!country && list.includes(country) },
    { headers: { "cache-control": "private, no-store" } },
  );
}
