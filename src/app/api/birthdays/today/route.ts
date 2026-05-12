import { NextRequest, NextResponse } from "next/server";
import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const pageKey = req.nextUrl.searchParams.get("page") ?? undefined;
    const slides = await getTodaysBirthdaySlides(pageKey);
    return NextResponse.json(slides, {
      headers: {
        // Allow CDN/edge caching for 5 min, allow stale for 1 hour while revalidating.
        // Vary by query string so per-page filtering is cached separately.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("Failed to load today's birthday slides:", err);
    return NextResponse.json([], { status: 200 });
  }
}
