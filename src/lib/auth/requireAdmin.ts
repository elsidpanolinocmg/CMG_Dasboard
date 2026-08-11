import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { findAdminStatus } from "@/lib/repos/people";
import { verifySessionToken, ADMIN_COOKIE_NAME, type AdminSession } from "./adminSession";

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Page-level gate: a valid session *and* a person still active and still
 * flagged `isAdmin`. Read from the database on every request so revoking
 * access takes effect immediately.
 *
 * Redirects, so it belongs in server components only — API routes must use
 * `requireAdminApi`, which returns a 401/403 instead of a redirect a `fetch`
 * would silently follow.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const h = await headers();
  const token = parseCookie(h.get("cookie"), ADMIN_COOKIE_NAME);
  const session = await verifySessionToken(token);
  if (!session) redirect("/admin/login");

  const status = await findAdminStatus(session.username);
  if (!status || !status.active || !status.isAdmin) {
    redirect("/admin/login?denied=1");
  }
  return session;
}
