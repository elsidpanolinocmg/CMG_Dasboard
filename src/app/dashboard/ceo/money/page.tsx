import { RegionalDashboard, type RegionView } from "@/components/ceo/RegionalDashboard";
import { cacheKeys, getCache, ttls } from "@/lib/cache";
import { fromEpochDay, parseCivilDate, today, toEpochDay } from "@/lib/ceo/week";
import { loadCeoMoneySettings } from "@/lib/ceo-money/settings";
import { loadInvoiceRegister, type InvoiceRegister } from "@/lib/ceo-money/invoice-register";
import { buildRegionDashboard } from "@/lib/ceo-money/metrics";
import { formatBusinessWeek, reportingWeekFor } from "@/lib/ceo-money/reporting-week";
import { REGIONS, type Region } from "@/lib/ceo-money/regions";

// The reporting week rolls at Singapore midnight, so this page must never be
// statically rendered — it would keep serving last week's numbers.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = { title: "All Regions Money — CMG Dashboard" };

/** Reads one region's register through the tiered cache, falling back to a
 *  direct sheet read if the cache backend is unreachable. */
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

/** An explicitly requested week (URL ?asOf= or CEO_MONEY_AS_OF), clamped to today. */
function explicitAsOf(raw: string | string[] | undefined): { asOf: string; pinned: boolean } | null {
  const now = today();
  const requested =
    parseCivilDate(Array.isArray(raw) ? raw[0] : raw) ?? parseCivilDate(process.env.CEO_MONEY_AS_OF);
  if (requested === null) return null;

  const asOf = toEpochDay(requested) > toEpochDay(now) ? now : requested;
  return { asOf, pinned: asOf !== now };
}

/**
 * The all-regions overview: SG, HK and ME side by side in three columns. Every
 * region shares one week — a Monday–Friday business week shown one week in
 * arrears (see `reporting-week`), rolling every Friday, regardless of when each
 * region last invoiced.
 */
export default async function CeoMoneyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const explicit = explicitAsOf(search.asOf);
  const rw = reportingWeekFor(today());
  // The window's close (Sunday) drives every figure; a pinned ?asOf= overrides it.
  const asOf = explicit?.asOf ?? fromEpochDay(rw.end);
  const cacheDate = asOf;

  if (search.cache === "clear") {
    for (const region of REGIONS) {
      try {
        await getCache().invalidate(cacheKeys.ceoInvoiceRegister(cacheDate, region.key));
      } catch (err) {
        console.error("[ceo-money] cache invalidate failed:", err);
      }
    }
  }

  // Thresholds and exchange rates come from Page settings → CEO · Money,
  // falling back to the built-in defaults.
  const { config: ceoConfig } = await loadCeoMoneySettings();

  const loaded: Array<{ region: Region; register: InvoiceRegister }> = [];
  let anyLive = false;

  for (const region of REGIONS) {
    let register: InvoiceRegister;
    try {
      register = await loadRegionRegister(region, cacheDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ceo-money] ${region.tab} unreadable:`, err);
      register = { rows: [], source: "sample", tab: region.tab, rates: {}, warnings: [`Could not read ${region.tab}: ${message}`] };
    }
    if (register.source === "sheet") anyLive = true;
    loaded.push({ region, register });
  }

  const regions: RegionView[] = loaded.map(({ region, register }) => ({
    label: region.label,
    data: buildRegionDashboard(register, asOf, ceoConfig, region.revenueTarget, region.overdueTarget),
  }));

  // Explain the deliberate lag, unless a week was explicitly pinned.
  const weekNote: string | null = explicit
    ? null
    : `Held back to let collections settle — the last fully-settled Friday–Thursday week (${formatBusinessWeek(
        fromEpochDay(rw.labelStart),
        fromEpochDay(rw.labelEnd),
      )}), rolling every Friday.`;

  const asOfQuery = typeof search.asOf === "string" ? `?asOf=${encodeURIComponent(search.asOf)}` : "";
  const accounts = [
    { key: "all", label: "All Regions", href: `/dashboard/ceo/money${asOfQuery}` },
    ...REGIONS.map((r) => ({ key: r.key, label: r.label, href: `/dashboard/ceo/money/${r.key}${asOfQuery}` })),
    { key: "awards", label: "2026 Awards", href: `/dashboard/ceo/money/awards${asOfQuery}` },
  ];

  return (
    <RegionalDashboard
      asOf={asOf}
      pinned={explicit?.pinned ?? false}
      live={anyLive}
      sourceLabel="the accounts workbook (all tabs)"
      regions={regions}
      config={ceoConfig}
      accounts={accounts}
      activeAccount="all"
      weekNote={weekNote}
    />
  );
}
