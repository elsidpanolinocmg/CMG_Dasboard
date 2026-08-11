import { RegionalDashboard, type RegionView } from "@/components/ceo/RegionalDashboard";
import { cacheKeys, getCache, ttls } from "@/lib/cache";
import { formatWeekRange, fromEpochDay, parseCivilDate, today, toEpochDay, weekEnd, weekStart } from "@/lib/ceo/week";
import { loadCeoMoneySettings } from "@/lib/ceo-money/settings";
import { latestIssueDay, loadInvoiceRegister, type InvoiceRegister } from "@/lib/ceo-money/invoice-register";
import { buildRegionDashboard } from "@/lib/ceo-money/metrics";
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
 * The all-regions overview: SG, HK and ME side by side in three columns. Each
 * region follows its own latest invoiced week (like its per-account page), so a
 * quiet week in one region never blanks the others.
 */
export default async function CeoMoneyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const explicit = explicitAsOf(search.asOf);
  const now = today();
  const cacheDate = explicit?.asOf ?? now;

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

  // Load every region first so all three can share a single week.
  const loaded: Array<{ region: Region; register: InvoiceRegister; latest: number | null }> = [];
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
    loaded.push({ region, register, latest: latestIssueDay(register, toEpochDay(now)) });
  }

  // One shared week for all three columns: the most recent week ANY region
  // invoiced (capped at today), so cash/revenue read the same Fri–Thu window
  // everywhere rather than a different week per region.
  const maxLatest = loaded.reduce<number | null>(
    (mx, l) => (l.latest === null ? mx : mx === null ? l.latest : Math.max(mx, l.latest)),
    null,
  );
  const asOf = explicit?.asOf ?? (maxLatest === null ? now : fromEpochDay(maxLatest));

  const regions: RegionView[] = loaded.map(({ region, register }) => ({
    label: region.label,
    data: buildRegionDashboard(register, asOf, ceoConfig, region.revenueTarget, region.overdueTarget),
  }));

  // Say so when the shared week isn't the current calendar week.
  let weekNote: string | null = null;
  if (!explicit && maxLatest !== null) {
    const shownFriday = weekStart(toEpochDay(asOf));
    if (shownFriday !== weekStart(toEpochDay(now))) {
      weekNote = `Showing the latest week any region invoiced (${formatWeekRange(
        fromEpochDay(shownFriday),
        fromEpochDay(weekEnd(toEpochDay(asOf))),
      )}), shared across all three regions.`;
    }
  }

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
