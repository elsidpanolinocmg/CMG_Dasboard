import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { isDenied, requireAdminApi } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { getRepo } from "@/lib/repos/registry";
import { validateDeleteInput } from "@/lib/repos/validateInput";
import * as birthdaysRepo from "@/lib/repos/birthdays";
import * as peopleRepo from "@/lib/repos/people";
import * as brandsRepo from "@/lib/repos/brands";
import * as bindingsRepo from "@/lib/repos/dataSourceBindings";
import * as dashboardsRepo from "@/lib/repos/dashboards";

/**
 * Deleting a department used to leave every reference to it behind — people and
 * publications still listing it, plus orphaned bindings and sub-pages that no
 * screen could reach. Clean those up in the same request and report what went.
 */
async function cascadeDepartmentDelete(slug: string) {
  const [people, brands, bindings, dashboards] = await Promise.all([
    peopleRepo.removeDepartmentEverywhere(slug),
    brandsRepo.removeDepartmentEverywhere(slug),
    bindingsRepo.removeByDepartment(slug),
    dashboardsRepo.removeByDepartment(slug),
  ]);
  return { people, brands, bindings, dashboards };
}

export const runtime = "nodejs";

function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await requireAdminApi(req);
  if (isDenied(session)) return session;

  const { entity } = await params;
  const repo = getRepo(entity);
  if (!repo) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const invalid = validateDeleteInput(entity, body as Record<string, unknown>);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // Capture any media we should clean up after the row is gone
  let blobUrlToDelete: string | null = null;
  if (entity === "birthdays" && typeof body.id === "string") {
    const existing = await birthdaysRepo.findById(body.id);
    if (existing && typeof existing.mediaPath === "string" && isOurBlobUrl(existing.mediaPath)) {
      blobUrlToDelete = existing.mediaPath;
    }
  }

  await repo.remove(body);

  const cascade =
    entity === "departments" && typeof body.slug === "string"
      ? await cascadeDepartmentDelete(body.slug)
      : null;

  if (blobUrlToDelete) {
    try {
      await del(blobUrlToDelete);
    } catch (err) {
      // Don't fail the request — DB row is already gone. Just log so we can
      // garbage-collect orphans later if needed.
      console.error("entity delete: blob del failed", { url: blobUrlToDelete, err });
    }
  }

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
    ...(cascade ? { metadata: { cascade } } : {}),
  });
  return NextResponse.json({ ok: true, ...(cascade ? { cascade } : {}) });
}
