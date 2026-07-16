import { RegionalDashboard, type RegionView } from "@/components/ceo/RegionalDashboard";
import { cacheKeys, getCache, ttls } from "@/lib/cache";
import { parseCivilDate, today, toEpochDay } from "@/lib/ceo/week";
import { DEFAULT_CONFIG } from "@/lib/ceo-money/config";
import { loadInvoiceRegister, type InvoiceRegister } from "@/lib/ceo-money/invoice-register";
import { buildRegionDashboard } from "@/lib/ceo-money/metrics";
import { REGIONS, type Region } from "@/lib/ceo-money/regions";

// The reporting week rolls at Singapore midnight, so this page must never be
// statically rendered — it would keep serving last week's numbers.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = {
  title: "CEO Money — CMG Dashboard",
};

/**
 * Reads one region's register through the tiered cache, falling back to a direct
 * sheet read if the cache backend is unreachable. A cache is an optimisation; it
 * must not be able to take the numbers off the wall.
 */
async function loadRegionRegister(region: Region, asOf: string): Promise<InvoiceRegister> {
  const key = cacheKeys.ceoInvoiceRegister(asOf, region.key);
  const read = () => loadInvoiceRegister(asOf, { tab: region.tab, columns: region.columns });

  try {
    return await getCache().getOrLoad<InvoiceRegister>(key, read, {
      ttlMs: ttls.CEO_MONEY_LEDGER,
      staleMs: ttls.CEO_MONEY_LEDGER_STALE,
    });
  } catch (err) {
    console.error(`[ceo-money] cache unavailable for ${region.tab}, reading through:`, err);
    return read();
  }
}

/**
 * Which week to render, in precedence order:
 *
 *   1. `?asOf=2026-06-19` (or `?asOf=6/19/26`) — a URL override, for looking at
 *      one past week without touching anything.
 *   2. `CEO_MONEY_AS_OF` — freezes the page on one week while the numbers are
 *      being checked by hand. **Unset it and the page follows the clock again.**
 *   3. Today, in Singapore. This is what a wallboard must show.
 *
 * A future date is clamped to today. The week ahead has no invoices in it, and a
 * wallboard showing an empty red week because someone fat-fingered a year would
 * be worse than ignoring the parameter.
 */
function resolveAsOf(raw: string | string[] | undefined): { asOf: string; pinned: boolean } {
  const now = today();

  const requested =
    parseCivilDate(Array.isArray(raw) ? raw[0] : raw) ?? parseCivilDate(process.env.CEO_MONEY_AS_OF);
  if (requested === null) return { asOf: now, pinned: false };

  const asOf = toEpochDay(requested) > toEpochDay(now) ? now : requested;
  return { asOf, pinned: asOf !== now };
}

export default async function CeoMoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { asOf, pinned } = resolveAsOf(params.asOf);

  if (params.cache === "clear") {
    try {
      await Promise.all(
        REGIONS.map((r) => getCache().invalidate(cacheKeys.ceoInvoiceRegister(asOf, r.key))),
      );
    } catch (err) {
      console.error("[ceo-money] cache invalidate failed:", err);
    }
  }

  // Each region reads independently. One tab failing degrades that region's row,
  // not the whole wall — a broken read shows an empty sample register with a
  // warning rather than taking the page down.
  const registers = await Promise.all(
    REGIONS.map(async (region) => {
      try {
        return { region, register: await loadRegionRegister(region, asOf) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ceo-money] ${region.tab} unreadable:`, err);
        const register: InvoiceRegister = {
          rows: [],
          source: "sample",
          tab: region.tab,
          rates: {},
          warnings: [`Could not read ${region.tab}: ${message}`],
        };
        return { region, register };
      }
    }),
  );

  const live = registers.some(({ register }) => register.source === "sheet");

  const regions: RegionView[] = registers.map(({ region, register }) => ({
    label: region.label,
    data: buildRegionDashboard(register, asOf, DEFAULT_CONFIG, region.revenueTarget),
  }));

  return (
    <RegionalDashboard
      asOf={asOf}
      pinned={pinned}
      live={live}
      sourceLabel="the accounts workbook"
      regions={regions}
      config={DEFAULT_CONFIG}
    />
  );
}
