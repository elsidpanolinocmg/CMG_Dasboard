import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { setPassword } from "@/lib/repos/people";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || password.length < 6) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const hash = await bcrypt.hash(password, 12);
  await setPassword(username, hash);
  return NextResponse.json({ ok: true });
}
