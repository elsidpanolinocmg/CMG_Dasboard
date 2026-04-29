import { getDb } from "@/lib/db";
import type { Brand, DepartmentBrand } from "@/lib/entities";

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

export async function findByGroup(groupSlug: string): Promise<Brand[]> {
  return (await col()).find({ groupSlug }).sort({ slug: 1 }).toArray();
}

export async function findByDepartment(deptSlug: string): Promise<Brand[]> {
  const db = await getDb();
  const links = await db
    .collection<DepartmentBrand>("department_brands")
    .find({ departmentSlug: deptSlug, enabled: true })
    .toArray();
  if (links.length === 0) return [];
  const slugs = links.map((l) => l.brandSlug);
  return (await col()).find({ slug: { $in: slugs }, active: true }).toArray();
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

export async function remove(slug: string): Promise<void> {
  await (await col()).deleteOne({ slug });
}
