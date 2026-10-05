import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { resolveChannel } from "@/lib/youtubeChannel";
import { parseYouTubeId } from "@/lib/youtube";
import {
  getLiveSetting,
  normalizeLiveSetting,
  saveLiveSetting,
  type LiveSetting,
} from "@/lib/rotation/liveSetting";

export const dynamic = "force-dynamic";

/**
 * Saves the Editorial Live page settings. `channelInput` / `videoInput` are
 * whatever the admin pasted; they are looked up here so saved ids are real.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const body = (await req.json().catch(() => null)) as
    | (Partial<LiveSetting> & { channelInput?: unknown; videoInput?: unknown })
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const before = await getLiveSetting();
  let { channelId, channelName, videoId } = before;

  if (body.source === "channel") {
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
    if (!channelId) {
      return NextResponse.json({ error: "Please paste the channel link" }, { status: 400 });
    }
  }

  if (body.source === "video") {
    const input = typeof body.videoInput === "string" ? body.videoInput : "";
    if (input.trim()) {
      const id = parseYouTubeId(input);
      if (!id) {
        return NextResponse.json(
          { error: "Couldn't find a YouTube video in that link" },
          { status: 400 },
        );
      }
      videoId = id;
    }
    if (!videoId) {
      return NextResponse.json({ error: "Please paste the video link" }, { status: 400 });
    }
  }

  const next = normalizeLiveSetting({ ...body, channelId, channelName, videoId });
  await saveLiveSetting(next);
  await logActivity(req, {
    action: "editorial-live.update",
    targetType: "page-settings",
    targetId: "editorial/live",
    before,
    after: next,
  });
  return NextResponse.json(next);
}
