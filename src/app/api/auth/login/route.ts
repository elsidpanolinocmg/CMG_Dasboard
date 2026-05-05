import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findAuthByUsername, recordLogin } from "@/lib/repos/people";
import { buildSetCookie, createSessionToken } from "@/lib/auth/adminSession";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const person = await findAuthByUsername(username);
  if (!person?.passwordHash || !person.active) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, person.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { token, expiresAt } = await createSessionToken(username);

  // Fire-and-forget: the login response doesn't depend on lastLoginAt being persisted.
  recordLogin(username).catch(() => {});

  const res = NextResponse.json({ ok: true, username });
  res.headers.set("Set-Cookie", buildSetCookie(token, expiresAt));
  return res;
}
