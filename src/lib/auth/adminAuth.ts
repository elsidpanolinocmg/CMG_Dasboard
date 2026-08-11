import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, type AdminSession } from "@/lib/auth/adminSession";
import { findAdminStatus } from "@/lib/repos/people";

export async function getAdminSession(
  req: NextRequest | Request,
): Promise<AdminSession | null> {
  return getSessionFromRequest(req);
}

/**
 * The gate every admin API route should use: a valid session *and* a person who
 * is still active and still flagged `isAdmin`.
 *
 * The check hits the database rather than trusting the cookie, so revoking
 * someone's admin rights or deactivating them cuts access immediately instead
 * of when their week-long token happens to expire.
 *
 * Returns the session, or the response to send back.
 */
export async function requireAdminApi(
  req: NextRequest | Request,
): Promise<AdminSession | NextResponse> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await findAdminStatus(session.username);
  if (!status || !status.active || !status.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export function isDenied(x: AdminSession | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
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
