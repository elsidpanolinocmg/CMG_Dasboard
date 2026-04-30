import Link from "next/link";
import * as departments from "@/lib/repos/departments";
import DepartmentForm from "./DepartmentForm";
import ToggleCheckbox from "../_widgets/ToggleCheckbox";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const rows = await departments.listAll();
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Departments
          <Hint>Click a department to see its team and publications.</Hint>
        </h1>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Route prefix</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center opacity-60">
                  No departments yet. Add one below.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr
                key={d.slug}
                className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/departments/${encodeURIComponent(d.slug)}`}
                    className="block underline-offset-2 hover:underline"
                  >
                    {d.displayName}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs opacity-70">{d.routePrefix}</td>
                <td className="px-3 py-2">{d.order}</td>
                <td className="px-3 py-2">
                  <ToggleCheckbox
                    entity="departments"
                    field="enabled"
                    identifier={{ slug: d.slug }}
                    initial={d.enabled}
                    title="Toggle enabled"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <CollapsibleAdd label="+ Add department">
        <DepartmentForm />
      </CollapsibleAdd>
    </div>
  );
}
