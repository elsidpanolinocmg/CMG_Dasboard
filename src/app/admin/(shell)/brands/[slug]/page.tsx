import Link from "next/link";
import { notFound } from "next/navigation";
import * as brands from "@/lib/repos/brands";
import * as departments from "@/lib/repos/departments";
import BrandEditor from "../BrandEditor";

export const dynamic = "force-dynamic";

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const [brand, depts, knownGroups] = await Promise.all([
    brands.findBySlug(slug),
    departments.listAll(),
    brands.listGroups(),
  ]);
  if (!brand) notFound();

  const safe = {
    slug: brand.slug,
    displayName: brand.displayName,
    url: brand.url ?? "",
    color: brand.color ?? "",
    secondaryColor: brand.secondaryColor ?? "",
    image: brand.image ?? "",
    group: brand.group ?? "",
    ga4PropertyId: brand.ga4PropertyId ?? "",
    ga4FilterFieldName: brand.ga4Filter?.fieldName ?? "",
    ga4FilterMatchType: brand.ga4Filter?.matchType ?? "",
    ga4FilterValue: brand.ga4Filter?.value ?? "",
    drupalDomain: brand.drupalDomain ?? "",
    awardsShowcaseId: brand.awardsShowcaseId ?? "",
    departments: brand.departments ?? [],
    active: brand.active,
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/admin/brands" className="text-sm opacity-60 hover:opacity-100">
          ← Publications
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{brand.displayName}</h1>
      </div>
      <BrandEditor
        brand={safe}
        departmentSlugs={depts.map((d) => d.slug)}
        knownGroups={knownGroups}
      />
    </div>
  );
}
