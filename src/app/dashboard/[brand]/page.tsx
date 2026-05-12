import { notFound } from "next/navigation";
import nextDynamic from "next/dynamic";
import { Suspense } from "react";
import * as brandsRepo from "@/lib/repos/brands";
import LoadingPage from "@/components/LoadingPage";
import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";

const BrandDashboard = nextDynamic(() => import("@/components/BrandDashboard"));
const BrandWithBirthdayRotator = nextDynamic(
  () => import("@/components/BrandWithBirthdayRotator"),
);

export const dynamic = "force-dynamic";

export default async function BrandDrillInPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand: rawBrand } = await params;
  const brand = decodeURIComponent(rawBrand).toLowerCase();
  const [row, birthdays] = await Promise.all([
    brandsRepo.findBySlug(brand),
    getTodaysBirthdaySlides("dashboard/[brand]"),
  ]);
  if (!row) notFound();

  const siteConfig = {
    name: row.displayName,
    url: row.url,
    image: row.image,
  };

  return (
    <Suspense fallback={<LoadingPage loadingText={`Loading ${row.displayName}…`} />}>
      <div className="flex flex-col w-screen min-h-screen overflow-hidden">
        {birthdays.length > 0 ? (
          <BrandWithBirthdayRotator
            brand={brand}
            siteConfig={siteConfig}
            birthdays={birthdays}
          />
        ) : (
          <BrandDashboard brand={brand} siteConfig={siteConfig} />
        )}
      </div>
    </Suspense>
  );
}
