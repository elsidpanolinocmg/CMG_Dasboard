import { NextResponse } from "next/server";
import { buildClearCookie } from "@/lib/auth/adminSession";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildClearCookie());
  return res;
}
