import { NextResponse } from "next/server";

interface VimeoTextTrack {
  active?: boolean;
  type?: string;
  language?: string;
  link?: string;
  name?: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return new NextResponse("invalid id", { status: 400 });
  }

  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) {
    console.error("vimeo-captions: VIMEO_ACCESS_TOKEN not set");
    return new NextResponse("token missing", { status: 500 });
  }

  try {
    const listRes = await fetch(`https://api.vimeo.com/videos/${id}/texttracks`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
      cache: "no-store",
    });
    if (!listRes.ok) {
      return new NextResponse("", { status: listRes.status });
    }

    const body: { data?: VimeoTextTrack[] } = await listRes.json();
    const tracks = body.data ?? [];
    const track =
      tracks.find((t) => t.active && t.type === "captions") ??
      tracks.find((t) => t.type === "captions") ??
      tracks.find((t) => t.type === "subtitles") ??
      tracks[0];

    if (!track?.link) {
      return new NextResponse("", { status: 404 });
    }

    const vttRes = await fetch(track.link, { cache: "no-store" });
    if (!vttRes.ok) {
      return new NextResponse("", { status: vttRes.status });
    }

    return new NextResponse(await vttRes.text(), {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error(`vimeo-captions/${id} failed:`, err);
    return new NextResponse("", { status: 500 });
  }
}
