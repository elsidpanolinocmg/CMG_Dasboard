import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { removeDepartment } from "@/lib/repos/people";

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
  await removeDepartment(username, departmentSlug);
  return NextResponse.json({ ok: true });
}
