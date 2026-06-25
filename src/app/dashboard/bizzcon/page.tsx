import { Suspense } from "react";
import * as brandsRepo from "@/lib/repos/brands";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { getEvents, type EventBrand } from "@/lib/sources/drupalEvents";
import LoadingPage from "@/components/LoadingPage";
import BizzconGridClient from "./BizzconGridClient";
import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";

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
  if (!sources.length) return [];
  return getCache().getOrLoad(
    cacheKeys.bizzconEvents(),
    () => getEvents(sources),
    { ttlMs: ttls.BIZZCON, staleMs: ttls.BIZZCON_STALE },
  );
}

async function BizzconContent() {
  const [events, birthdays] = await Promise.all([
    loadEvents(),
    getTodaysBirthdaySlides("dashboard/bizzcon"),
  ]);
  return <BizzconGridClient events={events} birthdays={birthdays} />;
}

export default function BizzconPage() {
  return (
    <div className="h-[100dvh] max-w-screen overflow-hidden bg-white text-gray-900">
      <Suspense fallback={<LoadingPage loadingText="Loading Events..." />}>
        <BizzconContent />
      </Suspense>
    </div>
  );
}
