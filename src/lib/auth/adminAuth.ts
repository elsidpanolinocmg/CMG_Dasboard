import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, type AdminSession } from "@/lib/auth/adminSession";

export async function getAdminSession(
  req: NextRequest | Request,
): Promise<AdminSession | null> {
  return getSessionFromRequest(req);
}

export async function requireAdminSession(
  req: NextRequest | Request,
): Promise<AdminSession | NextResponse> {
  const s = await getSessionFromRequest(req);
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return s;
}

export function isUnauthorized(x: AdminSession | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}
