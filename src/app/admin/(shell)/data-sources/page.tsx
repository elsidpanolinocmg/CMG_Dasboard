import * as externalDataSources from "@/lib/repos/externalDataSources";
import DataSourceForm from "./DataSourceForm";
import DataSourcesTable from "./DataSourcesTable";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  const rows = await externalDataSources.listAll();
  const safe = rows.map((r) => ({
    kind: r.kind,
    displayName: r.displayName,
    credentialRef: r.credentialRef,
  }));
  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="font-semibold">
          Data sources
          <Hint>
            Registry of external systems (GA4, Vimeo, Google Sheets, Drupal). The
            credentialRef is the <em>name</em> of the env var holding the secret —
            never the secret itself. Click <em>Edit</em> on a row to update the
            display name or credential env var.
          </Hint>
        </h1>
      </div>

      <DataSourcesTable rows={safe} />

      <CollapsibleAdd label="+ Add data source">
        <DataSourceForm />
      </CollapsibleAdd>
    </div>
  );
}
