import { MarketingDashboard } from "@/components/ceo/MarketingDashboard";
import { cacheKeys, getCache, ttls } from "@/lib/cache";
import { parseCivilDate, today, toEpochDay } from "@/lib/ceo/week";
import { loadWeeklyLeads, type WeeklyLeads } from "@/lib/ceo-marketing/leads-sheet";
import { generateSampleLeadLedger } from "@/lib/ceo-marketing/sample-data";

// The reporting week rolls at Singapore midnight, so this page must never be
// statically rendered — it would keep serving last week's numbers.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = {
  title: "CEO Marketing — CMG Dashboard",
};

/**
 * Which week to render: a `?asOf=` URL override, then `CEO_MARKETING_AS_OF` (a
 * testing freeze), then today. Same shape as the money page.
 */
function resolveAsOf(raw: string | string[] | undefined): { asOf: string; pinned: boolean } {
  const now = today();
  const requested =
    parseCivilDate(Array.isArray(raw) ? raw[0] : raw) ?? parseCivilDate(process.env.CEO_MARKETING_AS_OF);
  if (requested === null) return { asOf: now, pinned: false };

  const asOf = toEpochDay(requested) > toEpochDay(now) ? now : requested;
  return { asOf, pinned: asOf !== now };
}

async function loadLeadsThroughCache(asOf: string): Promise<WeeklyLeads> {
  const key = cacheKeys.ceoMarketingLeads(asOf);
  try {
    return await getCache().getOrLoad<WeeklyLeads>(key, () => loadWeeklyLeads(asOf), {
      ttlMs: ttls.CEO_MONEY_LEDGER,
      staleMs: ttls.CEO_MONEY_LEDGER_STALE,
    });
  } catch (err) {
    console.error("[ceo-marketing] cache unavailable for leads, reading through:", err);
    return loadWeeklyLeads(asOf);
  }
}

export default async function CeoMarketingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { asOf, pinned } = resolveAsOf(params.asOf);

  if (params.cache === "clear") {
    try {
      await getCache().invalidate(cacheKeys.ceoMarketingLeads(asOf));
    } catch (err) {
      console.error("[ceo-marketing] cache invalidate failed:", err);
    }
  }

  // Leads come from the weekly sheet; cost per lead is still sample. A failed
  // read degrades to sample leads rather than taking the page down.
  let weekly: WeeklyLeads = { leads: null, cpl: null, weekLabel: null, sections: 0, source: "none", warnings: [] };
  try {
    weekly = await loadLeadsThroughCache(asOf);
  } catch (err) {
    console.error("[ceo-marketing] leads unreadable:", err);
  }

  const ledger = generateSampleLeadLedger(asOf);
  const live = weekly.source === "sheet";

  return (
    <MarketingDashboard
      ledger={ledger}
      asOf={asOf}
      fullscreen
      pinned={pinned}
      leadsLive={live}
      leadsOverride={live ? weekly.leads : undefined}
      cplOverride={live ? weekly.cpl : undefined}
      weekLabel={weekly.weekLabel}
      leadsWarnings={weekly.warnings}
    />
  );
}
