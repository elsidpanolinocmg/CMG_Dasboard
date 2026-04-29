import * as brands from "@/lib/repos/brands";
import * as departments from "@/lib/repos/departments";
import BrandForm from "./BrandForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const [rows, depts, groups] = await Promise.all([
    brands.listAll(),
    departments.listAll(),
    brands.listGroups(),
  ]);
  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Brands</h1>
        <p className="text-sm opacity-60 mt-1">
          Canonical brand list. Departments and group are stored on the brand
          itself — no separate join collections.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Departments</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">GA4 property</th>
              <th className="px-3 py-2 font-medium">Drupal domain</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center opacity-60">
                  No brands yet.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr
                key={b.slug}
                className="border-t border-black/10 dark:border-white/10"
              >
                <td className="px-3 py-2 font-mono text-xs">{b.slug}</td>
                <td className="px-3 py-2">{b.displayName}</td>
                <td className="px-3 py-2 text-xs">
                  {(b.departments ?? []).length === 0
                    ? "—"
                    : (b.departments ?? []).map((d) => (
                        <span
                          key={d}
                          className="inline-block mr-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-mono text-[10px]"
                        >
                          {d}
                        </span>
                      ))}
                </td>
                <td className="px-3 py-2 text-xs opacity-70">{b.group ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs opacity-70">
                  {b.ga4PropertyId ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs opacity-70">
                  {b.drupalDomain ?? "—"}
                </td>
                <td className="px-3 py-2">{b.active ? "yes" : "no"}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton entity="brands" payload={{ slug: b.slug }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BrandForm
        departmentSlugs={depts.map((d) => d.slug)}
        knownGroups={groups}
      />
    </div>
  );
}
