import * as departments from "@/lib/repos/departments";
import * as dataSourceBindings from "@/lib/repos/dataSourceBindings";
import * as externalDataSources from "@/lib/repos/externalDataSources";
import BindingForm from "./BindingForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function BindingsPage() {
  const [depts, sources, rows] = await Promise.all([
    departments.listAll(),
    externalDataSources.listAll(),
    dataSourceBindings.listAll(),
  ]);
  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Data source bindings</h1>
        <p className="text-sm opacity-60 mt-1">
          Wires a department to a data source for a specific purpose. Replaces
          hardcoded sheet IDs and domain maps with config rows.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Purpose</th>
              <th className="px-3 py-2 font-medium">Source kind</th>
              <th className="px-3 py-2 font-medium">Config</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center opacity-60">
                  No bindings yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={`${r.departmentSlug}/${r.purpose}/${r.dataSourceKind}`}
                className="border-t border-black/10 dark:border-white/10"
              >
                <td className="px-3 py-2 font-mono text-xs">{r.departmentSlug}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.purpose}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.dataSourceKind}</td>
                <td className="px-3 py-2 font-mono text-xs opacity-70 truncate max-w-md">
                  {JSON.stringify(r.config)}
                </td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton
                    entity="bindings"
                    payload={{
                      departmentSlug: r.departmentSlug,
                      purpose: r.purpose,
                      dataSourceKind: r.dataSourceKind,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BindingForm
        departmentSlugs={depts.map((d) => d.slug)}
        sourceKinds={sources.map((s) => s.kind)}
      />
    </div>
  );
}
