import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { resolveChannel } from "@/lib/youtubeChannel";
import {
  getYouTubeChannelSetting,
  normalizeSetting,
  saveYouTubeChannelSetting,
  type YouTubeChannelSetting,
} from "@/lib/rotation/youtubeChannelSetting";

export const dynamic = "force-dynamic";

/**
 * Saves the site-wide YouTube channel slide. `channelInput` is whatever link
 * the admin pasted; it is looked up here so the saved id is always real.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const body = (await req.json().catch(() => null)) as
    | (Partial<YouTubeChannelSetting> & { channelInput?: unknown })
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const before = await getYouTubeChannelSetting();
  let { channelId, channelName } = before;
  const input = typeof body.channelInput === "string" ? body.channelInput.trim().slice(0, 500) : "";
  if (input) {
    const channel = await resolveChannel(input);
    if (!channel) {
      return NextResponse.json(
        { error: "Couldn't find a YouTube channel at that link" },
        { status: 404 },
      );
    }
    channelId = channel.channelId;
    channelName = channel.name;
  }

  const next = normalizeSetting({ ...body, channelId, channelName });
  await saveYouTubeChannelSetting(next);
  await logActivity(req, {
    action: "youtube-channel.update",
    targetType: "page-settings",
    targetId: "rotation/youtube-channel",
    before,
    after: next,
  });
  return NextResponse.json(next);
}
