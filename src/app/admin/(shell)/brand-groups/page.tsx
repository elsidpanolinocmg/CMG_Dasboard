import * as brandGroups from "@/lib/repos/brandGroups";
import BrandGroupForm from "./BrandGroupForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function BrandGroupsPage() {
  const rows = await brandGroups.listAll();
  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Brand groups</h1>
        <p className="text-sm opacity-60 mt-1">
          Bundles of brands. A brand opts into a group via its `groupSlug` field.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center opacity-60">
                  No brand groups yet.
                </td>
              </tr>
            )}
            {rows.map((g) => (
              <tr key={g.slug} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-mono text-xs">{g.slug}</td>
                <td className="px-3 py-2">{g.displayName}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton entity="brand-groups" payload={{ slug: g.slug }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BrandGroupForm />
    </div>
  );
}
