import * as adminReferences from "@/lib/repos/adminReferences";
import AdminReferenceForm from "./AdminReferenceForm";
import RemoveButton from "../_widgets/RemoveButton";
import Hint from "../_widgets/Hint";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";

export const dynamic = "force-dynamic";

export default async function AdminReferencesPage() {
  const rows = await adminReferences.listAll();
  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="font-semibold">
          Admin references
          <Hint>Quick-access links shown on the admin dashboard.</Hint>
        </h1>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">URL</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center opacity-60">
                  No references yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 font-mono text-xs truncate max-w-xs">
                  <a href={r.href} target="_blank" rel="noreferrer" className="underline">
                    {r.href}
                  </a>
                </td>
                <td className="px-3 py-2">{r.order}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton entity="admin-references" payload={{ id: r.id }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <CollapsibleAdd label="+ Add reference">
        <AdminReferenceForm />
      </CollapsibleAdd>
    </div>
  );
}
