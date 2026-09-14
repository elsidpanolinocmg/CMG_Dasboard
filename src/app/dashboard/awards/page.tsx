import { Suspense } from "react";
import * as brandsRepo from "@/lib/repos/brands";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { getAwards, type AwardsBrand } from "@/lib/sources/drupalAwards";
import { manualAwards } from "@/lib/sources/manualEvents";
import LoadingPage from "@/components/LoadingPage";
import AwardsGridClient from "./AwardsGridClient";
import { getRotationSlides } from "@/lib/rotation/slides";

export const dynamic = "force-dynamic";

async function loadAwards() {
  const list = await brandsRepo.findByDepartment("awards");
  const sources: AwardsBrand[] = list
    .filter((b) => !!b.url)
    .map((b) => ({ brand: b.slug, name: b.displayName, url: b.url! }));
  const scraped = sources.length
    ? await getCache().getOrLoad(
        cacheKeys.awardsList(),
        () => getAwards(sources),
        { ttlMs: ttls.AWARDS, staleMs: ttls.AWARDS_STALE },
      )
    : [];
  // Manual events are read straight from the DB (not cached) so admin edits
  // show up immediately.
  return [...scraped, ...manualAwards(list)].sort(
    (a, b) => new Date(a.field_date).getTime() - new Date(b.field_date).getTime(),
  );
}

async function AwardsContent() {
  const [awards, birthdays] = await Promise.all([
    loadAwards(),
    getRotationSlides("dashboard/awards"),
  ]);
  return <AwardsGridClient awards={awards} birthdays={birthdays} />;
}

export default function AwardsPage() {
  return (
    <div className="h-lvh max-w-screen overflow-hidden bg-white text-gray-900">
      <Suspense fallback={<LoadingPage loadingText="Loading Awards..." />}>
        <AwardsContent />
      </Suspense>
    </div>
  );
}
