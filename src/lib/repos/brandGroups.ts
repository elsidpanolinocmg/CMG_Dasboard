import { getDb } from "@/lib/db";
import type { BrandGroup } from "@/lib/entities";

const COLLECTION = "brand_groups";

async function col() {
  const db = await getDb();
  return db.collection<BrandGroup>(COLLECTION);
}

export async function findBySlug(slug: string): Promise<BrandGroup | null> {
  return (await col()).findOne({ slug });
}

export async function listAll(): Promise<BrandGroup[]> {
  return (await col()).find({}).sort({ slug: 1 }).toArray();
}

export async function upsert(
  group: Omit<BrandGroup, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { slug: group.slug },
    {
      $set: { ...group, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(slug: string): Promise<void> {
  await (await col()).deleteOne({ slug });
}
