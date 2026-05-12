import { NextResponse } from "next/server";
import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const slides = await getTodaysBirthdaySlides();
    return NextResponse.json(slides, {
      headers: {
        // Allow CDN/edge caching for 5 min, allow stale for 1 hour while revalidating.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("Failed to load today's birthday slides:", err);
    return NextResponse.json([], { status: 200 });
  }
}
