import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

export async function requireAdmin(): Promise<AdminSession> {
  const h = await headers();
  const token = parseCookie(h.get("cookie"), ADMIN_COOKIE_NAME);
  const session = await verifySessionToken(token);
  if (!session) redirect("/admin/login");
  return session;
}
