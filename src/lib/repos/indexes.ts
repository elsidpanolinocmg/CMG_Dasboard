import type { Db, IndexSpecification, CreateIndexesOptions } from "mongodb";

export interface IndexSpec {
  collection: string;
  name?: string;
  keys: IndexSpecification;
  options?: CreateIndexesOptions;
}

export const indexSpecs: IndexSpec[] = [
  { collection: "people", keys: { username: 1 }, options: { unique: true } },
  { collection: "people", keys: { nameKeys: 1 } },
  { collection: "people", keys: { active: 1 } },
  { collection: "people", keys: { "departments.departmentSlug": 1 } },
  {
    collection: "people",
    keys: { "departments.departmentSlug": 1, "departments.role": 1 },
  },

  { collection: "departments", keys: { slug: 1 }, options: { unique: true } },
  { collection: "departments", keys: { order: 1 } },

  { collection: "brands", keys: { slug: 1 }, options: { unique: true } },
  { collection: "brands", keys: { departments: 1 } },
  { collection: "brands", keys: { group: 1 } },
  { collection: "brands", keys: { active: 1 } },

  {
    collection: "dashboards",
    keys: { departmentSlug: 1, slug: 1 },
    options: { unique: true },
  },
  { collection: "dashboards", keys: { departmentSlug: 1, order: 1 } },

  {
    collection: "external_data_sources",
    keys: { kind: 1 },
    options: { unique: true },
  },

  {
    collection: "data_source_bindings",
    keys: { departmentSlug: 1, purpose: 1, dataSourceKind: 1 },
    options: { unique: true },
  },

  { collection: "admin_references", keys: { id: 1 }, options: { unique: true } },
  { collection: "admin_references", keys: { order: 1 } },

  { collection: "saved_references", keys: { id: 1 }, options: { unique: true } },

  { collection: "cache_entries", keys: { key: 1 }, options: { unique: true } },
  {
    collection: "cache_entries",
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0 },
  },
];

export const LEGACY_COLLECTIONS_TO_DROP = [
  "person_departments",
  "department_brands",
  "brand_groups",
];

export async function applyIndexes(db: Db): Promise<void> {
  for (const spec of indexSpecs) {
    const col = db.collection(spec.collection);
    await col.createIndex(spec.keys, spec.options);
  }
}
