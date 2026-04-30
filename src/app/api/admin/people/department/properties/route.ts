import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { findByUsername, setDepartmentProperties } from "@/lib/repos/people";
import { invalidateDeptCaches } from "@/lib/cache/invalidateForDept";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const departmentSlug =
    typeof body?.departmentSlug === "string" ? body.departmentSlug.trim() : "";
  const propsRaw = body?.properties;
  if (!username || !departmentSlug || !propsRaw || typeof propsRaw !== "object") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  // Coerce all values to strings; drop empty keys.
  const properties: Record<string, string> = {};
  for (const [k, v] of Object.entries(propsRaw)) {
    const key = k.trim();
    if (!key) continue;
    properties[key] = String(v ?? "");
  }
  const before = await findByUsername(username);
  const beforeProps =
    before?.departments?.find((d) => d.departmentSlug === departmentSlug)?.properties ?? {};
  await setDepartmentProperties(username, departmentSlug, properties);
  await logActivity(req, {
    action: "people.department.properties.set",
    targetType: "people",
    targetId: username,
    before: beforeProps,
    after: properties,
    metadata: { departmentSlug },
  });
  await invalidateDeptCaches(departmentSlug);
  return NextResponse.json({ ok: true });
}
