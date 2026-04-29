import { getDb } from "@/lib/db";
import type { SavedReference } from "@/lib/entities";

const COLLECTION = "saved_references";

async function col() {
  const db = await getDb();
  return db.collection<SavedReference>(COLLECTION);
}

export async function findById(id: string): Promise<SavedReference | null> {
  return (await col()).findOne({ id });
}

export async function listAll(): Promise<SavedReference[]> {
  return (await col()).find({}).sort({ id: 1 }).toArray();
}

export async function upsert(
  ref: Omit<SavedReference, "createdAt" | "updatedAt">,
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
