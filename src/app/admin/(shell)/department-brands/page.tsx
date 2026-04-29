import * as departments from "@/lib/repos/departments";
import * as brands from "@/lib/repos/brands";
import * as departmentBrands from "@/lib/repos/departmentBrands";
import DepartmentBrandForm from "./DepartmentBrandForm";
import RemoveButton from "../_widgets/RemoveButton";

export const dynamic = "force-dynamic";

export default async function DepartmentBrandsPage() {
  const [depts, brandList] = await Promise.all([
    departments.listAll(),
    brands.listAll(),
  ]);
  const allLinks: { departmentSlug: string; brandSlug: string; enabled: boolean }[] = [];
  for (const d of depts) {
    const links = await departmentBrands.listByDepartment(d.slug);
    allLinks.push(
      ...links.map((l) => ({
        departmentSlug: l.departmentSlug,
        brandSlug: l.brandSlug,
        enabled: l.enabled,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Department brands</h1>
        <p className="text-sm opacity-60 mt-1">
          Per-department brand opt-in. A row links one department to one brand.
        </p>
      </div>

      <section className="border border-black/10 dark:border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
              <th className="px-3 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {allLinks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center opacity-60">
                  No links yet.
                </td>
              </tr>
            )}
            {allLinks.map((l) => (
              <tr
                key={`${l.departmentSlug}/${l.brandSlug}`}
                className="border-t border-black/10 dark:border-white/10"
              >
                <td className="px-3 py-2 font-mono text-xs">{l.departmentSlug}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.brandSlug}</td>
                <td className="px-3 py-2">{l.enabled ? "yes" : "no"}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveButton
                    entity="department-brands"
                    payload={{
                      departmentSlug: l.departmentSlug,
                      brandSlug: l.brandSlug,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <DepartmentBrandForm
        departmentSlugs={depts.map((d) => d.slug)}
        brandSlugs={brandList.map((b) => b.slug)}
      />
    </div>
  );
}
