import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { addDepartment } from "@/lib/repos/people";
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
  await addDepartment(username, departmentSlug, role);
  return NextResponse.json({ ok: true });
}
