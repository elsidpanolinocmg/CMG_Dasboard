import { NextResponse } from "next/server";
import { getLiveStatus } from "@/lib/youtubeChannel";
import { getYouTubeChannelSetting } from "@/lib/rotation/youtubeChannelSetting";

export const dynamic = "force-dynamic";

/** Live status of the channel set in Admin → YouTube channel, for the Live page. */
export async function GET() {
  try {
    const setting = await getYouTubeChannelSetting();
    const live = await getLiveStatus(setting.channelId);
    return NextResponse.json(
      {
        ...live,
        channelId: setting.channelId,
        channelName: setting.channelName,
        subtitles: setting.subtitles,
      },
      // Every Live screen polls this; a minute at the edge spares YouTube.
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("youtube/live: failed", err);
    return NextResponse.json({ status: "offline" }, { status: 503 });
  }
}
