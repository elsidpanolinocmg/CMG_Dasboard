import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { getRepo } from "@/lib/repos/registry";
import { invalidateDeptCaches } from "@/lib/cache/invalidateForDept";

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
  await logActivity(req, {
    action: `${entity}.upsert`,
    targetType: entity,
    targetId: extractTargetId(entity, body),
    after: body,
  });
  await invalidateCacheFor(entity, body);
  return NextResponse.json({ ok: true });
}

async function invalidateCacheFor(
  entity: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (entity === "bindings") {
    const dept = typeof body.departmentSlug === "string" ? body.departmentSlug : "";
    if (dept) await invalidateDeptCaches(dept);
    return;
  }
  if (entity === "people") {
    // Person edits (synonyms, departments, properties) affect every leaderboard
    // they belong to. Invalidate each membership's department prefix.
    const depts = Array.isArray(body.departments) ? body.departments : [];
    const slugs = depts
      .map((d) =>
        d && typeof d === "object" && typeof (d as { departmentSlug?: unknown }).departmentSlug === "string"
          ? ((d as { departmentSlug: string }).departmentSlug)
          : "",
      )
      .filter((s) => s);
    await invalidateDeptCaches(...slugs);
    return;
  }
  if (entity === "page-settings") {
    // pageKey is shaped like "dashboard/{dept}/{view}". The department prefix
    // is what scoped caches are keyed under, so changing a dashboard's advanced
    // settings (filters, dedup, etc.) immediately busts any cached output.
    const pageKey = typeof body.pageKey === "string" ? body.pageKey : "";
    const m = /^dashboard\/([^/]+)\//.exec(pageKey);
    if (m) await invalidateDeptCaches(m[1]);
    return;
  }
}

function extractTargetId(entity: string, body: Record<string, unknown>): string | undefined {
  if (entity === "people") return typeof body.username === "string" ? body.username : undefined;
  if (entity === "bindings") {
    const dept = body.departmentSlug;
    const purpose = body.purpose;
    const kind = body.dataSourceKind;
    return [dept, purpose, kind].filter(Boolean).join("/");
  }
  if (entity === "page-settings") {
    return typeof body.pageKey === "string" ? body.pageKey : undefined;
  }
  if (typeof body.slug === "string") return body.slug;
  if (typeof body.id === "string") return body.id;
  return undefined;
}
