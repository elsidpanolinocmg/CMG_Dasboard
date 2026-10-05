import { NextResponse } from "next/server";
import { getLiveSetting, resolveLiveSource } from "@/lib/rotation/liveSetting";

export const dynamic = "force-dynamic";

/**
 * What the Editorial Live page should play, from Admin → YouTube channel →
 * Live page. Whether a channel is live is worked out in the viewer's browser
 * (YouTube hides live streams from data-centre servers), so this only names
 * the source.
 */
export async function GET() {
  try {
    const setting = await getLiveSetting();
    const source = await resolveLiveSource(setting);
    return NextResponse.json(
      {
        ...source,
        subtitles: setting.subtitles,
        whenOffline: setting.whenOffline,
        offlineMessage: setting.offlineMessage,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("youtube/live: failed", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
