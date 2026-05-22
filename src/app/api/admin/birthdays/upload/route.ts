import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];

function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// Client-upload flow: the browser uploads the file directly to Vercel Blob,
// so it never passes through this serverless function and is not subject to
// Vercel's ~4.5 MB request-body limit. This endpoint only (1) issues a scoped,
// short-lived upload token after checking the admin session, and (2) receives
// Blob's server-to-server completion callback.
export async function POST(req: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      // Runs for the browser's token request, which carries the admin cookie.
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getAdminSession(req);
        if (!session) throw new Error("Unauthorized");

        if (!pathname.startsWith("birthdays/")) {
          throw new Error("Invalid upload path");
        }

        // Best-effort audit log here, where we still have the admin's session
        // and real IP (the upload-completed callback is server-to-server and
        // does not carry either, and does not fire on localhost).
        try {
          const payload = clientPayload
            ? (JSON.parse(clientPayload) as {
                id?: string;
                mediaKind?: "image" | "video";
                size?: number;
                contentType?: string;
              })
            : {};
          await logActivity(req, {
            action: "birthdays.upload",
            targetType: "birthdays",
            targetId: payload.id,
            metadata: {
              mediaKind: payload.mediaKind,
              size: payload.size,
              contentType: payload.contentType,
              mediaPath: pathname,
            },
          });
        } catch (err) {
          console.error("birthdays/upload: activity log failed", err);
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
      // Required by handleUpload. Logging is handled above; nothing to do here.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("birthdays/upload: handleUpload failed", err);
    return NextResponse.json(
      { error: (err as Error).message || "Upload failed" },
      { status: 400 },
    );
  }
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
