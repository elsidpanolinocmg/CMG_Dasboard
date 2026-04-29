import Link from "next/link";
import { getDb } from "@/lib/db";

const SUMMARY = [
  { collection: "people", label: "People", href: "/admin/people" },
  { collection: "departments", label: "Departments", href: "/admin/departments" },
  { collection: "brands", label: "Brands", href: "/admin/brands" },
  { collection: "brand_groups", label: "Brand groups", href: "/admin/brand-groups" },
  { collection: "department_brands", label: "Department brands", href: "/admin/department-brands" },
  { collection: "dashboards", label: "Dashboards", href: "/admin/dashboards" },
  { collection: "external_data_sources", label: "Data sources", href: "/admin/data-sources" },
  { collection: "data_source_bindings", label: "Bindings", href: "/admin/bindings" },
  { collection: "admin_references", label: "Admin references", href: "/admin/admin-references" },
  { collection: "saved_references", label: "Saved references", href: "/admin/saved-references" },
  { collection: "cache_entries", label: "Cache entries", href: "/admin/cache" },
];

async function getCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const out: Record<string, number> = {};
  await Promise.all(
    SUMMARY.map(async (s) => {
      out[s.collection] = await db.collection(s.collection).estimatedDocumentCount();
    }),
  );
  return out;
}

export default async function AdminOverviewPage() {
  const counts = await getCounts();
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {SUMMARY.map((s) => (
          <Link
            key={s.collection}
            href={s.href}
            className="border border-black/10 dark:border-white/10 rounded-lg p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="text-xs uppercase tracking-wide opacity-60">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{counts[s.collection] ?? 0}</div>
            <div className="text-xs opacity-50 mt-1">{s.collection}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
