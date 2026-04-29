import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { getRepo } from "@/lib/repos/registry";

export const runtime = "nodejs";

async function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return unauthorized();

  const { entity } = await params;
  const repo = getRepo(entity);
  if (!repo) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });

  const items = await repo.list();
  return NextResponse.json({ items });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return unauthorized();

  const { entity } = await params;
  const repo = getRepo(entity);
  if (!repo) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await repo.upsert(body);
  return NextResponse.json({ ok: true });
}
