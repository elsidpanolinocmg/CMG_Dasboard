import { Suspense } from "react";
import * as brands from "@/lib/repos/brands";
import LoadingPage from "@/components/LoadingPage";
import BrandRotationClient, { type BrandEntry } from "./BrandRotationClient";
import { getRotationSlides } from "@/lib/rotation/slides";
import { brandSiteConfig } from "@/lib/util/brandSiteConfig";

export const dynamic = "force-dynamic";

export default async function EditorialPage() {
  const [publications, birthdaySlides] = await Promise.all([
    brands.findByDepartment("editorial"),
    getRotationSlides("dashboard/editorial"),
  ]);
  const entries: BrandEntry[] = publications.map((b) => ({
    brand: b.slug,
    siteConfig: brandSiteConfig(b),
  }));
  return (
    <Suspense fallback={<LoadingPage loadingText="Loading Editorial…" />}>
      <BrandRotationClient brands={entries} birthdays={birthdaySlides} />
    </Suspense>
  );
}
