import { getDb } from "@/lib/db";
import type { PageSetting } from "@/lib/entities";

const COLLECTION = "page_settings";

async function col() {
  const db = await getDb();
  return db.collection<PageSetting>(COLLECTION);
}

export async function findByKey(pageKey: string): Promise<PageSetting | null> {
  return (await col()).findOne({ pageKey });
}

export async function listAll(): Promise<PageSetting[]> {
  return (await col()).find({}).sort({ pageKey: 1 }).toArray();
}

export async function upsert(
  input: Omit<PageSetting, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { pageKey: input.pageKey },
    {
      $set: {
        pageKey: input.pageKey,
        label: input.label,
        settings: input.settings ?? {},
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(pageKey: string): Promise<void> {
  await (await col()).deleteOne({ pageKey });
}
