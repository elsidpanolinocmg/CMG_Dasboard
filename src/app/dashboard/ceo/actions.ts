"use server";

import { cachePrefixes, getCache } from "@/lib/cache";

/** The CEO board caches the Refresh button is allowed to clear. */
const CLEARABLE = new Set<string>([
  cachePrefixes.ceoMoney,
  cachePrefixes.ceoMarketing,
  cachePrefixes.ceoDeliverables,
  cachePrefixes.ceoVideoInterviews,
  cachePrefixes.ceoMagazineMaterials,
  cachePrefixes.ceoShortFormVideos,
]);

/**
 * Drops a CEO board's cached copies so the next render reads the sheet afresh —
 * what the Refresh button does before re-rendering. Anything outside the CEO board
 * prefixes is ignored, and the "last-good:" fallback copies are never touched.
 */
export async function clearCeoCache(prefixes: string[]): Promise<void> {
  const cache = getCache();
  await Promise.all(
    prefixes
      .filter((p) => CLEARABLE.has(p))
      .map((p) =>
        cache.invalidate(p, { prefix: true }).catch((err) => {
          // The render that follows still works — it just may hit a warm copy.
          console.error(`[ceo-cache] could not clear ${p}:`, err);
        }),
      ),
  );
}
