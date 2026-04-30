import * as pageSettings from "@/lib/repos/pageSettings";
import PageSettingsTable, { type ClientPageSetting } from "./PageSettingsTable";
import PageSettingsForm from "./PageSettingsForm";
import { PAGE_SCHEMAS } from "./schemas";
import Hint from "../_widgets/Hint";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";

export const dynamic = "force-dynamic";

export default async function PageSettingsPage() {
  const stored = await pageSettings.listAll();
  const storedByKey = new Map(stored.map((s) => [s.pageKey, s]));

  // Merge known pages with anything ad-hoc that's been saved.
  const merged: ClientPageSetting[] = [];
  for (const [pageKey, schema] of Object.entries(PAGE_SCHEMAS)) {
    const s = storedByKey.get(pageKey);
    merged.push({
      pageKey,
      label: schema.label,
      settings: (s?.settings as Record<string, unknown>) ?? {},
      saved: !!s,
      hasSchema: true,
    });
  }
  for (const s of stored) {
    if (PAGE_SCHEMAS[s.pageKey]) continue;
    merged.push({
      pageKey: s.pageKey,
      label: s.label ?? s.pageKey,
      settings: (s.settings as Record<string, unknown>) ?? {},
      saved: true,
      hasSchema: false,
    });
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="font-semibold">
          Page settings
          <Hint>Per-page controls and defaults. Click <em>Edit</em> to modify.</Hint>
        </h1>
      </div>

      <PageSettingsTable rows={merged} />

      <CollapsibleAdd label="+ Add custom page key">
        <PageSettingsForm />
      </CollapsibleAdd>
    </div>
  );
}
