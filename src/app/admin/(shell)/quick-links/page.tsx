import * as quickLinks from "@/lib/repos/quickLinks";
import QuickLinksTable, { type ClientQuickLink } from "./QuickLinksTable";
import QuickLinkForm from "./QuickLinkForm";
import Hint from "../_widgets/Hint";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";

export const dynamic = "force-dynamic";

export default async function QuickLinksPage() {
  const stored = await quickLinks.listAll();
  const rows: ClientQuickLink[] = stored.map((l) => ({
    id: l.id,
    label: l.label,
    href: l.href,
    description: l.description,
    // Rows saved before `active` existed have no value; treat those as visible.
    active: l.active !== false,
    order: l.order ?? 0,
    startsAt: l.startsAt ?? null,
    endsAt: l.endsAt ?? null,
  }));

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="font-semibold">
          Quick links
          <Hint>
            Text and a link, shown to everyone on the dashboard home page. Use
            it for announcements, forms, or anything the team needs one click
            away. Give a link a schedule and it appears and disappears on its
            own.
          </Hint>
        </h1>
      </div>

      <QuickLinksTable rows={rows} />

      <CollapsibleAdd label="+ Add quick link">
        <QuickLinkForm />
      </CollapsibleAdd>
    </div>
  );
}
