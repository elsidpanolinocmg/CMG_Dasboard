import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import {
  countAdmins,
  findAdminStatus,
  findAuthByUsername,
  setAdminAccess,
} from "@/lib/repos/people";

export const runtime = "nodejs";

/**
 * Grants or revokes admin-panel access. `isAdmin` is deliberately not writable
 * through the generic entity route, so this is the only way in — and it is the
 * only place the two lockout guards live.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const isAdmin = body?.isAdmin;
  if (!username || typeof isAdmin !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { username: string, isAdmin: boolean }" },
      { status: 400 },
    );
  }

  const target = await findAdminStatus(username);
  if (!target) {
    return NextResponse.json({ error: "No such person" }, { status: 404 });
  }

  if (!isAdmin) {
    // Two ways to lock everyone out of the panel; refuse both.
    if (username === session.username) {
      return NextResponse.json(
        { error: "You cannot remove your own admin access." },
        { status: 400 },
      );
    }
    if (target.isAdmin && (await countAdmins()) <= 1) {
      return NextResponse.json(
        { error: "This is the last admin — grant someone else access first." },
        { status: 400 },
      );
    }
  }

  if (isAdmin) {
    const auth = await findAuthByUsername(username);
    if (!auth?.passwordHash) {
      return NextResponse.json(
        { error: "Set a password for this person before granting admin access." },
        { status: 400 },
      );
    }
  }

  await setAdminAccess(username, isAdmin);
  await logActivity(req, {
    action: isAdmin ? "people.admin.grant" : "people.admin.revoke",
    targetType: "people",
    targetId: username,
    before: { isAdmin: target.isAdmin },
    after: { isAdmin },
  });
  return NextResponse.json({ ok: true });
}
