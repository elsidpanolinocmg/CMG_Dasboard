import { getDb } from "@/lib/db";
import type { ExternalDataSource, ExternalDataSourceKind } from "@/lib/entities";

const COLLECTION = "external_data_sources";

async function col() {
  const db = await getDb();
  return db.collection<ExternalDataSource>(COLLECTION);
}

export async function findByKind(
  kind: ExternalDataSourceKind,
): Promise<ExternalDataSource | null> {
  return (await col()).findOne({ kind });
}

export async function listAll(): Promise<ExternalDataSource[]> {
  return (await col()).find({}).sort({ kind: 1 }).toArray();
}

export async function upsert(
  source: Omit<ExternalDataSource, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { kind: source.kind },
    {
      $set: { ...source, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(kind: ExternalDataSourceKind): Promise<void> {
  await (await col()).deleteOne({ kind });
}
