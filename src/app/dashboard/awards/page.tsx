import { Suspense } from "react";
import * as brandsRepo from "@/lib/repos/brands";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { getAwards, type AwardsBrand } from "@/lib/sources/drupalAwards";
import LoadingPage from "@/components/LoadingPage";
import AwardsGridClient from "./AwardsGridClient";

export const dynamic = "force-dynamic";

async function loadAwards() {
  const list = await brandsRepo.findByDepartment("awards");
  const sources: AwardsBrand[] = list
    .filter((b) => !!b.url)
    .map((b) => ({ brand: b.slug, name: b.displayName, url: b.url! }));
  if (!sources.length) return [];
  return getCache().getOrLoad(
    cacheKeys.awardsList(),
    () => getAwards(sources),
    { ttlMs: ttls.AWARDS, staleMs: ttls.AWARDS_STALE },
  );
}

async function AwardsContent() {
  const awards = await loadAwards();
  return <AwardsGridClient awards={awards} />;
}

export default function AwardsPage() {
  return (
    <div className="min-h-screen max-w-screen overflow-auto bg-white text-gray-900">
      <Suspense fallback={<LoadingPage loadingText="Loading Awards..." />}>
        <AwardsContent />
      </Suspense>
    </div>
  );
}
