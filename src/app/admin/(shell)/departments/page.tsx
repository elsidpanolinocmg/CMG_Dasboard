import * as departments from "@/lib/repos/departments";
import DepartmentForm from "./DepartmentForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const rows = await departments.listAll();
  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-sm opacity-60 mt-1">
          The three verticals: editorial, awards, bizzcon. Adding a row makes a department first-class.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Route prefix</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-60">
                  No departments yet. Add one below.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr
                key={d.slug}
                className="border-t border-black/10 dark:border-white/10"
              >
                <td className="px-3 py-2 font-mono text-xs">{d.slug}</td>
                <td className="px-3 py-2">{d.displayName}</td>
                <td className="px-3 py-2 font-mono text-xs">{d.routePrefix}</td>
                <td className="px-3 py-2">{d.order}</td>
                <td className="px-3 py-2">{d.enabled ? "yes" : "no"}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton entity="departments" payload={{ slug: d.slug }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DepartmentForm />
    </div>
  );
}
