import { getDb } from "@/lib/db";
import { isQuickLinkVisible, type QuickLink } from "@/lib/entities";

const COLLECTION = "quick_links";

async function col() {
  const db = await getDb();
  return db.collection<QuickLink>(COLLECTION);
}

export async function findById(id: string): Promise<QuickLink | null> {
  return (await col()).findOne({ id });
}

export async function listAll(): Promise<QuickLink[]> {
  return (await col()).find({}).sort({ order: 1, label: 1 }).toArray();
}

/**
 * The rows the home page should show right now: switched on, and inside their
 * scheduled window. The window is applied in code rather than in the query
 * because the dates are ISO strings and the collection is a handful of rows —
 * a Mongo range filter here would buy nothing and mis-sort a bad value.
 */
export async function listVisible(now: Date = new Date()): Promise<QuickLink[]> {
  const all = await listAll();
  return all.filter((l) => isQuickLinkVisible(l, now));
}

export async function upsert(
  link: Omit<QuickLink, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { id: link.id },
    {
      $set: { ...link, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(id: string): Promise<void> {
  await (await col()).deleteOne({ id });
}
