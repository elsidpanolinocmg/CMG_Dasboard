import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { findOne } from "@/lib/repos/dataSourceBindings";
import { probeBinding } from "@/lib/sources/bindings";
import type { BindingPurpose, ExternalDataSourceKind } from "@/lib/entities";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const departmentSlug = typeof body?.departmentSlug === "string" ? body.departmentSlug : "";
  const purpose = body?.purpose as BindingPurpose;
  const dataSourceKind = body?.dataSourceKind as ExternalDataSourceKind;
  if (!departmentSlug || !purpose || !dataSourceKind) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const binding = await findOne(departmentSlug, purpose, dataSourceKind);
  if (!binding) return NextResponse.json({ error: "Binding not found" }, { status: 404 });

  const result = await probeBinding(binding);
  return NextResponse.json(result);
}
