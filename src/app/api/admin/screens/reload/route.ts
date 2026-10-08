import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { requestReload, type ReloadKind } from "@/lib/repos/screenReload";

export const runtime = "nodejs";

/**
 * Asks every open dashboard screen to refresh within about a minute: body
 * `{ kind: "soft" }` (default, keeps fullscreen) or `{ kind: "full" }`.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const body = (await req.json().catch(() => null)) as { kind?: unknown } | null;
  const kind: ReloadKind = body?.kind === "full" ? "full" : "soft";
  const at = await requestReload(kind);
  await logActivity(req, {
    action: kind === "full" ? "screens.reload" : "screens.refresh",
    targetType: "screens",
    targetId: "all",
  });
  return NextResponse.json({ kind, at });
}
