import { getDb } from "@/lib/db";
import type { Dashboard, DashboardSlug } from "@/lib/entities";

const COLLECTION = "dashboards";

async function col() {
  const db = await getDb();
  return db.collection<Dashboard>(COLLECTION);
}

export async function listByDepartment(deptSlug: string): Promise<Dashboard[]> {
  return (await col())
    .find({ departmentSlug: deptSlug, enabled: true })
    .sort({ order: 1 })
    .toArray();
}

export async function findBySlug(
  deptSlug: string,
  slug: DashboardSlug,
): Promise<Dashboard | null> {
  return (await col()).findOne({ departmentSlug: deptSlug, slug });
}

export async function upsert(
  dashboard: Omit<Dashboard, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    { departmentSlug: dashboard.departmentSlug, slug: dashboard.slug },
    {
      $set: { ...dashboard, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(deptSlug: string, slug: DashboardSlug): Promise<void> {
  await (await col()).deleteOne({ departmentSlug: deptSlug, slug });
}
