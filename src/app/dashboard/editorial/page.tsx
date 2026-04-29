import { Suspense } from "react";
import * as brands from "@/lib/repos/brands";
import LoadingPage from "@/components/LoadingPage";
import BrandRotationClient, { type BrandEntry } from "./BrandRotationClient";

export const dynamic = "force-dynamic";

export default async function EditorialPage() {
  const publications = await brands.findByDepartment("editorial");
  const entries: BrandEntry[] = publications.map((b) => ({
    brand: b.slug,
    siteConfig: {
      name: b.displayName,
      url: b.url,
      image: b.image,
    },
  }));
  return (
    <Suspense fallback={<LoadingPage loadingText="Loading Editorial…" />}>
      <BrandRotationClient brands={entries} />
    </Suspense>
  );
}
