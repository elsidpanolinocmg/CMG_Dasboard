import Link from "next/link";
import * as brands from "@/lib/repos/brands";
import * as departments from "@/lib/repos/departments";
import { humanize } from "@/lib/util/format";
import NewBrandForm from "./NewBrandForm";

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
          Click a brand to edit. Departments and group are stored on the brand
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center opacity-60">
                  No brands yet.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr
                key={b.slug}
                className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/admin/brands/${encodeURIComponent(b.slug)}`}
                    className="block underline-offset-2 hover:underline"
                  >
                    {b.slug}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/brands/${encodeURIComponent(b.slug)}`}
                    className="block"
                  >
                    {b.displayName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {(b.departments ?? []).length === 0
                    ? "—"
                    : (b.departments ?? []).map((d) => (
                        <span
                          key={d}
                          className="inline-block mr-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[11px]"
                        >
                          {humanize(d)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <NewBrandForm
        departmentSlugs={depts.map((d) => d.slug)}
        knownGroups={groups}
      />
    </div>
  );
}
