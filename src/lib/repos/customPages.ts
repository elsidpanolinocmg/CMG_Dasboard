import { getDb } from "@/lib/db";
import { isCustomPageLive, type CustomPage } from "@/lib/entities";

const COLLECTION = "custom_pages";

async function col() {
  const db = await getDb();
  return db.collection<CustomPage>(COLLECTION);
}

export async function findById(id: string): Promise<CustomPage | null> {
  return (await col()).findOne({ id });
}

export async function listAll(): Promise<CustomPage[]> {
  return (await col()).find({}).sort({ order: 1, title: 1 }).toArray();
}

/** Live pages flagged for the home page, in display order. */
export async function listForHome(now: Date = new Date()): Promise<CustomPage[]> {
  const all = await listAll();
  return all.filter((p) => p.showOnHome && isCustomPageLive(p, now));
}

/** Live pages that join the rotation of `pageKey`. */
export async function listForRotation(
  pageKey: string,
  now: Date = new Date(),
): Promise<CustomPage[]> {
  const all = await listAll();
  return all.filter(
    (p) =>
      Array.isArray(p.rotationPageKeys) &&
      p.rotationPageKeys.includes(pageKey) &&
      isCustomPageLive(p, now),
  );
}

export async function upsert(
  doc: Omit<CustomPage, "createdAt" | "updatedAt">,
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
