import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
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

  const filename = `${id}.${allowed.ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "birthdays");
  const filepath = path.join(dir, filename);
  const mediaPath = `/uploads/birthdays/${filename}`;

  try {
    await mkdir(dir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, bytes);
  } catch (err) {
    console.error("birthdays/upload: write failed", err);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  await logActivity(req, {
    action: "birthdays.upload",
    targetType: "birthdays",
    targetId: id,
    metadata: { mediaKind: allowed.kind, size: file.size, contentType: file.type },
  });

  return NextResponse.json({
    ok: true,
    mediaPath,
    mediaKind: allowed.kind,
  });
}
