import { getDb } from "@/lib/db";
import type { AdminReference } from "@/lib/entities";

const COLLECTION = "admin_references";

async function col() {
  const db = await getDb();
  return db.collection<AdminReference>(COLLECTION);
}

export async function findById(id: string): Promise<AdminReference | null> {
  return (await col()).findOne({ id });
}

export async function listAll(): Promise<AdminReference[]> {
  return (await col()).find({}).sort({ order: 1 }).toArray();
}

export async function upsert(
  ref: Omit<AdminReference, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { id: ref.id },
    {
      $set: { ...ref, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(id: string): Promise<void> {
  await (await col()).deleteOne({ id });
}
