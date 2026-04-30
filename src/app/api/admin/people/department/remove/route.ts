import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { findByUsername, removeDepartment } from "@/lib/repos/people";
import { invalidateDeptCaches } from "@/lib/cache/invalidateForDept";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const departmentSlug =
    typeof body?.departmentSlug === "string" ? body.departmentSlug.trim() : "";
  if (!username || !departmentSlug) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const before = await findByUsername(username);
  const removed = before?.departments?.find((d) => d.departmentSlug === departmentSlug) ?? null;
  await removeDepartment(username, departmentSlug);
  await logActivity(req, {
    action: "people.department.remove",
    targetType: "people",
    targetId: username,
    before: removed,
    after: null,
  });
  await invalidateDeptCaches(departmentSlug);
  return NextResponse.json({ ok: true });
}
