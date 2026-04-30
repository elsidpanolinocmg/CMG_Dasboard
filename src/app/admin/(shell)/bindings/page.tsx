import * as departments from "@/lib/repos/departments";
import * as dataSourceBindings from "@/lib/repos/dataSourceBindings";
import * as externalDataSources from "@/lib/repos/externalDataSources";
import BindingForm from "./BindingForm";
import BindingsTable, { type ClientBinding } from "./BindingsTable";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function BindingsPage() {
  const [depts, sources, rows] = await Promise.all([
    departments.listAll(),
    externalDataSources.listAll(),
    dataSourceBindings.listAll(),
  ]);
  const safe: ClientBinding[] = rows.map((r) => ({
    departmentSlug: r.departmentSlug,
    purpose: r.purpose,
    dataSourceKind: r.dataSourceKind,
    config: (r.config ?? {}) as Record<string, unknown>,
  }));
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Data source bindings
          <Hint>
            Wires a department to a data source for a specific purpose. Click{" "}
            <em>Edit</em> on a row to change the sheet ID, gid, tab name, or
            range. <em>Probe</em> tests the binding live.
          </Hint>
        </h1>
      </div>

      <BindingsTable rows={safe} />

      <CollapsibleAdd label="+ Add binding">
        <BindingForm
          departmentSlugs={depts.map((d) => d.slug)}
          sourceKinds={sources.map((s) => s.kind)}
        />
      </CollapsibleAdd>
    </div>
  );
}
