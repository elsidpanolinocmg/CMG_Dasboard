import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { logActivity } from "@/lib/auth/activityLog";
import { findByNameKeys, findByUsername, setNameKeys } from "@/lib/repos/people";
import { normalizeKey } from "@/lib/util/normalizeKey";
import { invalidateDeptCaches } from "@/lib/cache/invalidateForDept";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const rawKeys = Array.isArray(body?.nameKeys) ? body.nameKeys : null;
  if (!username || !rawKeys) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const k of rawKeys) {
    const n = normalizeKey(typeof k === "string" ? k : "");
    if (!n || seen.has(n)) continue;
    seen.add(n);
    normalized.push(n);
  }

  // Reject if any synonym is already claimed by another person.
  const owners = await findByNameKeys(normalized);
  const conflicts = owners
    .filter((p) => p.username !== username)
    .flatMap((p) =>
      p.nameKeys
        .filter((k) => normalized.includes(k))
        .map((k) => ({ key: k, ownerUsername: p.username, ownerDisplayName: p.displayName })),
    );
  if (conflicts.length > 0) {
    return NextResponse.json(
      {
        error: `Synonym already used by ${conflicts.map((c) => c.ownerUsername).join(", ")}`,
        conflicts,
      },
      { status: 409 },
    );
  }

  const before = await findByUsername(username);
  await setNameKeys(username, normalized);
  await logActivity(req, {
    action: "people.name-keys.set",
    targetType: "people",
    targetId: username,
    before: before?.nameKeys ?? [],
    after: normalized,
  });
  const slugs = (before?.departments ?? []).map((d) => d.departmentSlug);
  await invalidateDeptCaches(...slugs);
  return NextResponse.json({ ok: true, nameKeys: normalized });
}
