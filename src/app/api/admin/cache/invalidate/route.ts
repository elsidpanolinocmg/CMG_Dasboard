import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { getCache } from "@/lib/cache";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/** Matches the persistent backend's own prefix matching, for the preview count. */
async function countUnderPrefix(prefix: string): Promise<number> {
  const db = await getDb();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return db
    .collection("cache_entries")
    .countDocuments({ key: { $regex: `^${escaped}` } });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const prefix = typeof body?.prefix === "string" ? body.prefix.trim() : "";
  const dryRun = body?.dryRun === true;

  if (!key && !prefix) {
    return NextResponse.json({ error: "key or prefix required" }, { status: 400 });
  }

  // A preview, so the UI can say how many entries a prefix would take with it —
  // "g" and "ga4:" look equally harmless in a text box but differ by everything.
  if (dryRun) {
    const matches = await countUnderPrefix(prefix || key);
    return NextResponse.json({ ok: true, matches, dryRun: true });
  }

  const target = prefix || key;
  const removed = await getCache().invalidate(target, { prefix: !!prefix });

  await logActivity(req, {
    action: "cache.invalidate",
    targetType: "cache",
    targetId: target,
    metadata: { mode: prefix ? "prefix" : "key", removed },
  });

  return NextResponse.json({ ok: true, removed });
}
