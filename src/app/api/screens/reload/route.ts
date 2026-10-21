import { NextResponse } from "next/server";
import { getReloadSignal } from "@/lib/repos/screenReload";

export const dynamic = "force-dynamic";

/**
 * Polled by every open dashboard. A newer `at` than it loaded with means a
 * full reload; a newer `softAt` means a soft refresh that keeps fullscreen.
 */
export async function GET() {
  try {
    return NextResponse.json(
      await getReloadSignal(),
      // A short edge cache keeps a wall of screens from each hitting the DB.
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" } },
    );
  } catch (err) {
    console.error("screens/reload: failed", err);
    return NextResponse.json({ at: 0, softAt: 0 }, { status: 503 });
  }
}
