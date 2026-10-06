import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { requestReload } from "@/lib/repos/screenReload";

export const runtime = "nodejs";

/** Asks every open dashboard screen to reload itself within about a minute. */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const at = await requestReload();
  await logActivity(req, {
    action: "screens.reload",
    targetType: "screens",
    targetId: "all",
  });
  return NextResponse.json({ at });
}
