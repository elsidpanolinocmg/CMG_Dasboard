import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { addDepartment, findByUsername } from "@/lib/repos/people";
import { invalidateDeptCaches } from "@/lib/cache/invalidateForDept";
import type { PersonDepartmentRole } from "@/lib/entities";

export const runtime = "nodejs";

const VALID_ROLES: PersonDepartmentRole[] = [
  "managing_editor",
  "editor",
  "reporter",
  "admin",
  "viewer",
];

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const departmentSlug =
    typeof body?.departmentSlug === "string" ? body.departmentSlug.trim() : "";
  const role = body?.role as PersonDepartmentRole;
  if (!username || !departmentSlug || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const before = await findByUsername(username);
  const beforeRole = before?.departments?.find((d) => d.departmentSlug === departmentSlug)?.role ?? null;
  await addDepartment(username, departmentSlug, role);
  await logActivity(req, {
    action: "people.department.add",
    targetType: "people",
    targetId: username,
    before: { departmentSlug, role: beforeRole },
    after: { departmentSlug, role },
  });
  await invalidateDeptCaches(departmentSlug);
  return NextResponse.json({ ok: true });
}
