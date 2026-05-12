import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  BIRTHDAY_PAGE_KEYS,
  getEnabledPages,
  saveEnabledPages,
} from "@/lib/birthdays/visibility";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const enabled = await getEnabledPages();
  return NextResponse.json({
    known: BIRTHDAY_PAGE_KEYS,
    enabled: Array.from(enabled),
  });
}

export async function POST(req: NextRequest) {
  await requireAdmin();
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
