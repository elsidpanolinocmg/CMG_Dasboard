import { getDb } from "@/lib/db";
import type { DepartmentBrand } from "@/lib/entities";

const COLLECTION = "department_brands";

async function col() {
  const db = await getDb();
  return db.collection<DepartmentBrand>(COLLECTION);
}

export async function listByDepartment(deptSlug: string): Promise<DepartmentBrand[]> {
  return (await col())
    .find({ departmentSlug: deptSlug })
    .sort({ brandSlug: 1 })
    .toArray();
}

export async function listByBrand(brandSlug: string): Promise<DepartmentBrand[]> {
  return (await col())
    .find({ brandSlug })
    .sort({ departmentSlug: 1 })
    .toArray();
}

export async function upsert(
  link: Omit<DepartmentBrand, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { departmentSlug: link.departmentSlug, brandSlug: link.brandSlug },
    {
      $set: { ...link, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function setEnabled(
  deptSlug: string,
  brandSlug: string,
  enabled: boolean,
): Promise<void> {
  await (await col()).updateOne(
    { departmentSlug: deptSlug, brandSlug },
    { $set: { enabled, updatedAt: new Date() } },
  );
}

export async function remove(deptSlug: string, brandSlug: string): Promise<void> {
  await (await col()).deleteOne({ departmentSlug: deptSlug, brandSlug });
}
