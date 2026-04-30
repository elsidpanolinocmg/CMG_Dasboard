import * as brands from "@/lib/repos/brands";
import * as departments from "@/lib/repos/departments";
import NewBrandForm from "./NewBrandForm";
import BrandsTable, { type ClientBrand } from "./BrandsTable";
import CollapsibleAdd from "../_widgets/CollapsibleAdd";
import Hint from "../_widgets/Hint";

export const dynamic = "force-dynamic";

export default async function PublicationsPage() {
  const [rows, depts, groups] = await Promise.all([
    brands.listAll(),
    departments.listAll(),
    brands.listGroups(),
  ]);
  const safe: ClientBrand[] = rows.map((b) => ({
    slug: b.slug,
    displayName: b.displayName,
    url: b.url,
    color: b.color,
    departments: b.departments ?? [],
    group: b.group,
    ga4PropertyId: b.ga4PropertyId,
    active: b.active,
  }));
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-semibold">
          Publications
          <Hint>
            Click a publication to edit. Departments and group are stored on the
            publication itself — no separate join collections.
          </Hint>
        </h1>
      </div>

      <BrandsTable brands={safe} />

      <CollapsibleAdd label="+ Add publication">
        <NewBrandForm
          departmentSlugs={depts.map((d) => d.slug)}
          knownGroups={groups}
        />
      </CollapsibleAdd>
    </div>
  );
}
