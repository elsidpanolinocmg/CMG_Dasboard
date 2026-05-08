import { getDb } from "@/lib/db";
import type { Holiday } from "@/lib/entities";

const COLLECTION = "holidays";

async function col() {
  const db = await getDb();
  return db.collection<Holiday>(COLLECTION);
}

export async function listAll(): Promise<Holiday[]> {
  return (await col()).find({}).sort({ date: 1 }).toArray();
}

export async function findByDate(date: string): Promise<Holiday | null> {
  return (await col()).findOne({ date });
}

export async function existsOn(date: string): Promise<boolean> {
  const c = await col();
  const count = await c.countDocuments({ date }, { limit: 1 });
  return count > 0;
}

export async function upsert(
  doc: Omit<Holiday, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { date: doc.date },
    {
      $set: { ...doc, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(date: string): Promise<void> {
  await (await col()).deleteOne({ date });
}
