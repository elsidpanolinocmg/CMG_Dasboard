import { NextRequest, NextResponse } from "next/server";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import {
  BIRTHDAY_PAGE_KEYS,
  getEnabledPages,
  saveEnabledPages,
} from "@/lib/birthdays/visibility";

export const dynamic = "force-dynamic";

// `requireAdmin()` redirects, which `fetch` follows to the login page and reads
// as a 200 — the client would report "Saved" on a request that saved nothing.
// API routes must answer with a status instead.
export async function GET(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const enabled = await getEnabledPages();
  return NextResponse.json({
    known: BIRTHDAY_PAGE_KEYS,
    enabled: Array.from(enabled),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const enabled = (body as { enabled?: unknown })?.enabled;
  if (!Array.isArray(enabled) || !enabled.every((k) => typeof k === "string")) {
    return NextResponse.json(
      { error: "Body must be { enabled: string[] }" },
      { status: 400 },
    );
  }
  await saveEnabledPages(enabled as string[]);
  return NextResponse.json({ ok: true });
}
