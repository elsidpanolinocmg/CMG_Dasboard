import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dbName = process.env.MONGODB_DB ?? null;
  try {
    const adapter = await getAdapter();
    const collections = await adapter.listCollectionNames();
    return NextResponse.json({
      ok: true,
      db: dbName,
      collections: collections.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: dbName,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
