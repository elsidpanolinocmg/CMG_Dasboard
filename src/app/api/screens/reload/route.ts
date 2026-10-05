import { NextResponse } from "next/server";
import { getReloadAt } from "@/lib/repos/screenReload";

export const dynamic = "force-dynamic";

/** Polled by every open dashboard; a newer `at` than it loaded with means reload. */
export async function GET() {
  try {
    return NextResponse.json(
      { at: await getReloadAt() },
      // A short edge cache keeps a wall of screens from each hitting the DB.
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" } },
    );
  } catch (err) {
    console.error("screens/reload: failed", err);
    return NextResponse.json({ at: 0 }, { status: 503 });
  }
}
