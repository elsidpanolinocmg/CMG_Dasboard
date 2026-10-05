import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { resolveChannel } from "@/lib/youtubeChannel";

export const runtime = "nodejs";

/** Looks up a YouTube channel from a pasted link, for the custom page editor. */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const body = await req.json().catch(() => null);
  const input = typeof body?.input === "string" ? body.input.slice(0, 500) : "";
  if (!input.trim()) return NextResponse.json({ error: "Missing link" }, { status: 400 });

  const channel = await resolveChannel(input);
  if (!channel) {
    return NextResponse.json(
      { error: "Couldn't find a YouTube channel at that link" },
      { status: 404 },
    );
  }
  return NextResponse.json(channel);
}
