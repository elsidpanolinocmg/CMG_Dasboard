import * as savedReferences from "@/lib/repos/savedReferences";
import SavedReferenceForm from "./SavedReferenceForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function SavedReferencesPage() {
  const rows = await savedReferences.listAll();
  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Saved references</h1>
        <p className="text-sm opacity-60 mt-1">
          Bookmarked Google Sheets used for ad-hoc reference.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Spreadsheet</th>
              <th className="px-3 py-2 font-medium">Sheet</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center opacity-60">
                  No saved references yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 font-mono text-xs truncate max-w-xs">
                  {r.spreadsheetId}
                </td>
                <td className="px-3 py-2 text-xs opacity-70">{r.sheetName ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton entity="saved-references" payload={{ id: r.id }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SavedReferenceForm />
    </div>
  );
}
