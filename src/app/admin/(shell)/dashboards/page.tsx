import * as departments from "@/lib/repos/departments";
import * as dashboards from "@/lib/repos/dashboards";
import DashboardForm from "./DashboardForm";
import RemoveButton from "../_widgets/RemoveButton";
import Hint from "../_widgets/Hint";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";

export const dynamic = "force-dynamic";

export default async function DashboardsAdminPage() {
  const depts = await departments.listAll();
  const allRows: {
    departmentSlug: string;
    slug: string;
    routePath: string;
    enabled: boolean;
    order: number;
  }[] = [];
  for (const d of depts) {
    const list = await dashboards.listByDepartment(d.slug);
    allRows.push(
      ...list.map((r) => ({
        departmentSlug: r.departmentSlug,
        slug: r.slug,
        routePath: r.routePath,
        enabled: r.enabled,
        order: r.order,
      })),
    );
  }
  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="font-semibold">
          Dashboards
          <Hint>
            Sub-page registry per department. Drives /dashboard/[department]/[subpage].
          </Hint>
        </h1>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Sub-page</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-60">
                  No dashboards yet.
                </td>
              </tr>
            )}
            {allRows.map((r) => (
              <tr
                key={`${r.departmentSlug}/${r.slug}`}
                className="border-t border-black/10 dark:border-white/10"
              >
                <td className="px-3 py-2 font-mono text-xs">{r.departmentSlug}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.slug}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.routePath}</td>
                <td className="px-3 py-2">{r.order}</td>
                <td className="px-3 py-2">{r.enabled ? "yes" : "no"}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton
                    entity="dashboards"
                    payload={{ departmentSlug: r.departmentSlug, slug: r.slug }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <CollapsibleAdd label="+ Add dashboard">
        <DashboardForm departmentSlugs={depts.map((d) => d.slug)} />
      </CollapsibleAdd>
    </div>
  );
}
