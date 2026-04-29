import { NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { listAll } from "@/lib/repos/brands";
import { fetchActiveNow } from "@/lib/sources/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const value = await getCache().getOrLoad(
    cacheKeys.allActive(),
    async () => {
      const brands = await listAll({ active: true });
      const seenProperties = new Set<string>();
      let total = 0;
      const perBrand: { brand: string; value: number }[] = [];
      for (const b of brands) {
        if (!b.ga4PropertyId) continue;
        // Brands sharing a property without an explicit filter would double-count; skip duplicates.
        const key = `${b.ga4PropertyId}|${b.ga4Filter?.value ?? ""}`;
        if (seenProperties.has(key)) continue;
        seenProperties.add(key);
        try {
          const n = await fetchActiveNow(b.ga4PropertyId, b.ga4Filter);
          total += n;
          perBrand.push({ brand: b.slug, value: n });
        } catch {
          // ignore individual brand failures
        }
      }
      return { total, perBrand };
    },
    { ttlMs: ttls.ACTIVE_NOW, staleMs: ttls.ACTIVE_NOW_STALE },
  );
  return NextResponse.json(value);
}
