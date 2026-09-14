import { Suspense } from "react";
import * as brandsRepo from "@/lib/repos/brands";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { getEvents, type EventBrand } from "@/lib/sources/drupalEvents";
import { manualBizzconEvents } from "@/lib/sources/manualEvents";
import LoadingPage from "@/components/LoadingPage";
import BizzconGridClient from "./BizzconGridClient";
import { getRotationSlides } from "@/lib/rotation/slides";

export const dynamic = "force-dynamic";

async function loadEvents() {
  const list = await brandsRepo.findByDepartment("bizzcon");
  const sources: EventBrand[] = list
    .filter((b) => !!b.url)
    .map((b) => ({
      brand: b.slug,
      name: b.displayName,
      url: b.url!,
      image: b.image,
    }));
  const scraped = sources.length
    ? await getCache().getOrLoad(
        cacheKeys.bizzconEvents(),
        () => getEvents(sources),
        { ttlMs: ttls.BIZZCON, staleMs: ttls.BIZZCON_STALE },
      )
    : [];
  // Manual events are read straight from the DB (not cached) so admin edits
  // show up immediately.
  return [...scraped, ...manualBizzconEvents(list)].sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
  );
}

async function BizzconContent() {
  const [events, birthdays] = await Promise.all([
    loadEvents(),
    getRotationSlides("dashboard/bizzcon"),
  ]);
  return <BizzconGridClient events={events} birthdays={birthdays} />;
}

export default function BizzconPage() {
  return (
    <div className="h-lvh max-w-screen overflow-hidden bg-white text-gray-900">
      <Suspense fallback={<LoadingPage loadingText="Loading Events..." />}>
        <BizzconContent />
      </Suspense>
    </div>
  );
}
