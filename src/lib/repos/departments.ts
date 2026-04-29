import { getDb } from "@/lib/db";
import type { Department } from "@/lib/entities";

const COLLECTION = "departments";

async function col() {
  const db = await getDb();
  return db.collection<Department>(COLLECTION);
}

export async function findBySlug(slug: string): Promise<Department | null> {
  return (await col()).findOne({ slug });
}

export async function listEnabled(): Promise<Department[]> {
  return (await col()).find({ enabled: true }).sort({ order: 1 }).toArray();
}

export async function listAll(): Promise<Department[]> {
  return (await col()).find({}).sort({ order: 1 }).toArray();
}

export async function upsert(
  dept: Omit<Department, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { slug: dept.slug },
    {
      $set: { ...dept, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(slug: string): Promise<void> {
  await (await col()).deleteOne({ slug });
}
