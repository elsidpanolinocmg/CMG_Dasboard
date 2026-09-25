import { cacheKeys, ttls } from "@/lib/cache";
import { cachedSheetLoad } from "@/lib/ceo/cached-load";
import { formatSgtTimestamp } from "@/lib/ceo/format";
import { loadInvoiceRegister, type InvoiceRegister } from "./invoice-register";
import type { Region } from "./regions";

/**
 * One region's invoice register for a reporting week, the way every money page
 * reads it: through the shared cache, and — when the sheet can't be read — from the
 * last good copy for that same region and week, with a warning saying so (which the
 * board's notes chip shows). With no saved copy either, the read failure is thrown
 * for the page to handle.
 */
export async function loadRegionRegister(region: Region, asOf: string): Promise<InvoiceRegister> {
  const key = cacheKeys.ceoInvoiceRegister(asOf, region.key);
  const { value, staleSince } = await cachedSheetLoad({
    key,
    lastGoodKey: cacheKeys.lastGood(key),
    loader: () => loadInvoiceRegister(asOf, { tab: region.tab, columns: region.columns }),
    ttlMs: ttls.CEO_MONEY_LEDGER,
    staleMs: ttls.CEO_MONEY_LEDGER_STALE,
    lastGoodTtlMs: ttls.CEO_LAST_GOOD,
  });
  if (!staleSince) return value;
  return {
    ...value,
    warnings: [
      ...value.warnings,
      `${region.tab}: couldn't read the sheet — showing figures saved ${formatSgtTimestamp(staleSince)}.`,
    ],
  };
}
