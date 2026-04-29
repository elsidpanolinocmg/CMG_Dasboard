import { notFound } from "next/navigation";
import nextDynamic from "next/dynamic";
import { Suspense } from "react";
import * as brandsRepo from "@/lib/repos/brands";
import LoadingPage from "@/components/LoadingPage";

const BrandDashboard = nextDynamic(() => import("@/components/BrandDashboard"));

export const dynamic = "force-dynamic";

export default async function EditorialBrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand: rawBrand } = await params;
  const brand = decodeURIComponent(rawBrand).toLowerCase();
  const row = await brandsRepo.findBySlug(brand);
  if (!row || !(row.departments ?? []).includes("editorial")) notFound();

  return (
    <Suspense fallback={<LoadingPage loadingText={`Loading ${row.displayName}…`} />}>
      <div className="flex flex-col w-screen min-h-screen overflow-hidden">
        <BrandDashboard
          brand={brand}
          siteConfig={{
            name: row.displayName,
            url: row.url,
            image: row.image,
          }}
        />
      </div>
    </Suspense>
  );
}
