import { getDb } from "@/lib/db";
import type { Brand } from "@/lib/entities";

const COLLECTION = "brands";

async function col() {
  const db = await getDb();
  return db.collection<Brand>(COLLECTION);
}

export async function findBySlug(slug: string): Promise<Brand | null> {
  return (await col()).findOne({ slug });
}

export async function listAll(opts?: { active?: boolean }): Promise<Brand[]> {
  const filter = opts?.active !== undefined ? { active: opts.active } : {};
  return (await col()).find(filter).sort({ slug: 1 }).toArray();
}

export async function findByDepartment(deptSlug: string): Promise<Brand[]> {
  return (await col())
    .find({ departments: deptSlug, active: true })
    .sort({ slug: 1 })
    .toArray();
}

export async function findByGroup(group: string): Promise<Brand[]> {
  return (await col()).find({ group }).sort({ slug: 1 }).toArray();
}

export async function listGroups(): Promise<string[]> {
  const db = await getDb();
  const groups = (await db.collection<Brand>(COLLECTION).distinct("group")) as (string | null | undefined)[];
  return groups.filter((g): g is string => typeof g === "string" && g.length > 0).sort();
}

export async function upsert(
  brand: Omit<Brand, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { slug: brand.slug },
    {
      $set: { ...brand, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function setActive(slug: string, active: boolean): Promise<void> {
  await (await col()).updateOne(
    { slug },
    { $set: { active, updatedAt: new Date() } },
  );
}

export async function setDepartments(slug: string, departments: string[]): Promise<void> {
  await (await col()).updateOne(
    { slug },
    { $set: { departments, updatedAt: new Date() } },
  );
}

export async function addToDepartment(slug: string, deptSlug: string): Promise<void> {
  await (await col()).updateOne(
    { slug },
    {
      $addToSet: { departments: deptSlug },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function removeFromDepartment(slug: string, deptSlug: string): Promise<void> {
  await (await col()).updateOne(
    { slug },
    {
      $pull: { departments: deptSlug },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function removeDepartmentEverywhere(deptSlug: string): Promise<number> {
  const res = await (await col()).updateMany(
    { departments: deptSlug },
    {
      $pull: { departments: deptSlug },
      $set: { updatedAt: new Date() },
    },
  );
  return res.modifiedCount ?? 0;
}

export async function remove(slug: string): Promise<void> {
  await (await col()).deleteOne({ slug });
}
