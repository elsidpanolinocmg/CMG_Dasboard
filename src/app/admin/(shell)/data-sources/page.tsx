import * as externalDataSources from "@/lib/repos/externalDataSources";
import DataSourceForm from "./DataSourceForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const rows = await externalDataSources.listAll();
  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Data sources</h1>
        <p className="text-sm opacity-60 mt-1">
          Registry of external systems (GA4, Vimeo, Google Sheets, Drupal). The
          credentialRef is the *name* of the env var holding the secret — never
          the secret itself.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Credential env</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center opacity-60">
                  No data sources yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.kind} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-mono text-xs">{r.kind}</td>
                <td className="px-3 py-2">{r.displayName}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.credentialRef}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton entity="data-sources" payload={{ kind: r.kind }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DataSourceForm />
    </div>
  );
}
