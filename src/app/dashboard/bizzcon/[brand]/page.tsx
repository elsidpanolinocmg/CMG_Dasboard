import { Suspense } from "react";
import { notFound } from "next/navigation";
import * as brandsRepo from "@/lib/repos/brands";
import { getCache, ttls } from "@/lib/cache";
import { getEvents, type EventBrand } from "@/lib/sources/drupalEvents";
import LoadingPage from "@/components/LoadingPage";
import BizzconGridClient from "../BizzconGridClient";

export const dynamic = "force-dynamic";

async function loadEventsForBrand(slug: string) {
  const row = await brandsRepo.findBySlug(slug);
  if (!row || !(row.departments ?? []).includes("bizzcon")) return null;
  if (!row.url) return [];
  const sources: EventBrand[] = [
    { brand: row.slug, name: row.displayName, url: row.url, image: row.image },
  ];
  return getCache().getOrLoad(
    `bizzcon:events:${slug}`,
    () => getEvents(sources),
    { ttlMs: ttls.BIZZCON, staleMs: ttls.BIZZCON_STALE },
  );
}

async function BizzconBrandContent({ brand }: { brand: string }) {
  const events = await loadEventsForBrand(brand);
  if (events === null) notFound();
  return <BizzconGridClient events={events} />;
}

export default async function BizzconBrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand: rawBrand } = await params;
  const brand = decodeURIComponent(rawBrand).toLowerCase();
  return (
    <div className="h-[100dvh] max-w-screen overflow-hidden bg-white text-gray-900">
      <Suspense fallback={<LoadingPage loadingText="Loading Events..." />}>
        <BizzconBrandContent brand={brand} />
      </Suspense>
    </div>
  );
}
