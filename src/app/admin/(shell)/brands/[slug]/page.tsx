import Link from "next/link";
import { notFound } from "next/navigation";
import * as brands from "@/lib/repos/brands";
import * as departments from "@/lib/repos/departments";
import BrandEditor from "../BrandEditor";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
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
    image: brand.image ?? "",
    group: brand.group ?? "",
    ga4PropertyId: brand.ga4PropertyId ?? "",
    ga4FilterId: brand.ga4FilterId ?? "",
    drupalDomain: brand.drupalDomain ?? "",
    departments: brand.departments ?? [],
    active: brand.active,
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/admin/brands" className="text-sm opacity-60 hover:opacity-100">
          ← Brands
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{brand.displayName}</h1>
        <p className="text-sm opacity-60 font-mono mt-1">{brand.slug}</p>
      </div>
      <BrandEditor
        brand={safe}
        departmentSlugs={depts.map((d) => d.slug)}
        knownGroups={knownGroups}
      />
    </div>
  );
}
