import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED: Record<string, { ext: string; kind: "image" | "video" }> = {
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
};

function safeIdSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "birthday";
}

function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const idRaw = form.get("id");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof idRaw !== "string" || !idRaw.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const id = safeIdSegment(idRaw.trim());
  const allowed = ALLOWED[file.type];
  if (!allowed) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const pathname = `birthdays/${id}.${allowed.ext}`;

  let mediaUrl: string;
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    mediaUrl = blob.url;
  } catch (err) {
    console.error("birthdays/upload: blob put failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await logActivity(req, {
    action: "birthdays.upload",
    targetType: "birthdays",
    targetId: id,
    metadata: {
      mediaKind: allowed.kind,
      size: file.size,
      contentType: file.type,
      mediaPath: mediaUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    mediaPath: mediaUrl,
    mediaKind: allowed.kind,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = body && typeof (body as { url?: unknown }).url === "string"
    ? (body as { url: string }).url
    : null;
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  if (!isOurBlobUrl(url)) {
    return NextResponse.json(
      { error: "Refusing to delete: not a Vercel Blob URL" },
      { status: 400 },
    );
  }

  try {
    await del(url);
  } catch (err) {
    console.error("birthdays/upload DELETE: blob del failed", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  await logActivity(req, {
    action: "birthdays.media.delete",
    targetType: "birthdays",
    metadata: { mediaPath: url },
  });

  return NextResponse.json({ ok: true });
}
