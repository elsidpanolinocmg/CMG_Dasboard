import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { getRepo } from "@/lib/repos/registry";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entity } = await params;
  const repo = getRepo(entity);
  if (!repo) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await repo.remove(body);
  await logActivity(req, {
    action: `${entity}.delete`,
    targetType: entity,
    targetId:
      typeof body.username === "string"
        ? body.username
        : typeof body.slug === "string"
          ? body.slug
          : typeof body.id === "string"
            ? body.id
            : undefined,
    before: body,
  });
  return NextResponse.json({ ok: true });
}
