import { getDb } from "@/lib/db";
import type { Birthday } from "@/lib/entities";

const COLLECTION = "birthdays";

async function col() {
  const db = await getDb();
  return db.collection<Birthday>(COLLECTION);
}

export async function listAll(): Promise<Birthday[]> {
  return (await col()).find({}).sort({ birthMonth: 1, birthDay: 1, displayName: 1 }).toArray();
}

export async function findById(id: string): Promise<Birthday | null> {
  return (await col()).findOne({ id });
}

export async function listForToday(now: Date = new Date()): Promise<Birthday[]> {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return (await col())
    .find({ active: true, birthMonth: m, birthDay: d })
    .sort({ displayName: 1 })
    .toArray();
}

export async function upsert(
  doc: Omit<Birthday, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { id: doc.id },
    {
      $set: { ...doc, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(id: string): Promise<void> {
  await (await col()).deleteOne({ id });
}
