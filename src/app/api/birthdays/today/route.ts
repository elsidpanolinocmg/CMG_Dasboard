import { NextRequest, NextResponse } from "next/server";
import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";
import { getRotationSlides } from "@/lib/rotation/slides";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const pageKey = req.nextUrl.searchParams.get("page") ?? undefined;
    // With a page key this also returns the custom pages rotating on that page.
    const slides = pageKey
      ? await getRotationSlides(pageKey)
      : await getTodaysBirthdaySlides();
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
