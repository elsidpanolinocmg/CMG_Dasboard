import { getDb } from "@/lib/db";
import type {
  BindingPurpose,
  DataSourceBinding,
  ExternalDataSourceKind,
} from "@/lib/entities";

const COLLECTION = "data_source_bindings";

async function col() {
  const db = await getDb();
  return db.collection<DataSourceBinding>(COLLECTION);
}

export async function findByPurpose(
  deptSlug: string,
  purpose: BindingPurpose,
): Promise<DataSourceBinding[]> {
  return (await col())
    .find({ departmentSlug: deptSlug, purpose })
    .toArray();
}

export async function findOne(
  deptSlug: string,
  purpose: BindingPurpose,
  kind: ExternalDataSourceKind,
): Promise<DataSourceBinding | null> {
  return (await col()).findOne({
    departmentSlug: deptSlug,
    purpose,
    dataSourceKind: kind,
  });
}

export async function listAll(): Promise<DataSourceBinding[]> {
  return (await col())
    .find({})
    .sort({ departmentSlug: 1, purpose: 1, dataSourceKind: 1 })
    .toArray();
}

export async function listByDepartment(deptSlug: string): Promise<DataSourceBinding[]> {
  return (await col())
    .find({ departmentSlug: deptSlug })
    .sort({ purpose: 1 })
    .toArray();
}

export async function upsert(
  binding: Omit<DataSourceBinding, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = new Date();
  await (await col()).updateOne(
    {
      departmentSlug: binding.departmentSlug,
      purpose: binding.purpose,
      dataSourceKind: binding.dataSourceKind,
    },
    {
      $set: { ...binding, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export async function remove(
  deptSlug: string,
  purpose: BindingPurpose,
  kind: ExternalDataSourceKind,
): Promise<void> {
  await (await col()).deleteOne({
    departmentSlug: deptSlug,
    purpose,
    dataSourceKind: kind,
  });
}
