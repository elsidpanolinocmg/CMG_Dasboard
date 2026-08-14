import { notFound } from "next/navigation";
import { RegionalDashboard, type RegionView } from "@/components/ceo/RegionalDashboard";
import { cacheKeys, getCache, ttls } from "@/lib/cache";
import { fromEpochDay, parseCivilDate, today, toEpochDay } from "@/lib/ceo/week";
import { loadCeoMoneySettings } from "@/lib/ceo-money/settings";
import { loadInvoiceRegister, type InvoiceRegister } from "@/lib/ceo-money/invoice-register";
import { buildRegionDashboard } from "@/lib/ceo-money/metrics";
import { formatBusinessWeek, reportingWeekFor } from "@/lib/ceo-money/reporting-week";
import { getRegion, REGIONS, type Region } from "@/lib/ceo-money/regions";

// The reporting week rolls at Singapore midnight, so this page must never be
// statically rendered — it would keep serving last week's numbers.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ account: string }> }) {
  const region = getRegion((await params).account);
  return { title: region ? `${region.label} Money — CMG Dashboard` : "CEO Money — CMG Dashboard" };
}

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
 * An explicitly requested week, if any:
 *
 *   1. `?asOf=2026-06-19` (or `?asOf=6/19/26`) — a URL override, for looking at
 *      one past week without touching anything.
 *   2. `CEO_MONEY_AS_OF` — freezes the page on one week while the numbers are
 *      being checked by hand.
 *
 * Absent both, this returns null and the page follows the sheet instead (see the
 * page body). A future date is clamped to today: the week ahead has no invoices
 * in it, and a wallboard showing an empty red week because someone fat-fingered a
 * year would be worse than ignoring the parameter.
 */
function explicitAsOf(raw: string | string[] | undefined): { asOf: string; pinned: boolean } | null {
  const now = today();
  const requested =
    parseCivilDate(Array.isArray(raw) ? raw[0] : raw) ?? parseCivilDate(process.env.CEO_MONEY_AS_OF);
  if (requested === null) return null;

  const asOf = toEpochDay(requested) > toEpochDay(now) ? now : requested;
  return { asOf, pinned: asOf !== now };
}

export default async function CeoMoneyAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ account: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { account } = await params;
  const region = getRegion(account);
  if (!region) notFound();

  const search = await searchParams;
  const explicit = explicitAsOf(search.asOf);

  // The money week is a Monday–Friday business week, one week in arrears, rolling
  // every Friday — the same window every region shows. A pinned ?asOf= overrides.
  const rw = reportingWeekFor(today());
  const asOf = explicit?.asOf ?? fromEpochDay(rw.end);
  const pinned = explicit?.pinned ?? false;
  const cacheDate = asOf;

  if (search.cache === "clear") {
    try {
      await getCache().invalidate(cacheKeys.ceoInvoiceRegister(cacheDate, region.key));
    } catch (err) {
      console.error("[ceo-money] cache invalidate failed:", err);
    }
  }

  // Thresholds and exchange rates come from Page settings → CEO · Money,
  // falling back to the built-in defaults.
  const { config: ceoConfig } = await loadCeoMoneySettings();

  // A failed read degrades this account's page to an empty sample register with a
  // warning rather than taking the page down.
  let register: InvoiceRegister;
  try {
    register = await loadRegionRegister(region, cacheDate);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ceo-money] ${region.tab} unreadable:`, err);
    register = { rows: [], source: "sample", tab: region.tab, rates: {}, warnings: [`Could not read ${region.tab}: ${message}`] };
  }

  // Explain the deliberate lag, unless a week was explicitly pinned.
  const weekNote: string | null = explicit
    ? null
    : `Held back to let collections settle — the last fully-settled Friday–Thursday week (${formatBusinessWeek(
        fromEpochDay(rw.labelStart),
        fromEpochDay(rw.labelEnd),
      )}), rolling every Friday.`;

  const regionView: RegionView = {
    label: region.label,
    data: buildRegionDashboard(register, asOf, ceoConfig, region.revenueTarget, region.overdueTarget),
  };

  // Carry a URL week-pin across the account tabs so switching accounts keeps the
  // same week in view.
  const asOfQuery = typeof search.asOf === "string" ? `?asOf=${encodeURIComponent(search.asOf)}` : "";
  const accounts = [
    { key: "all", label: "All Regions", href: `/dashboard/ceo/money${asOfQuery}` },
    ...REGIONS.map((r) => ({
      key: r.key,
      label: r.label,
      href: `/dashboard/ceo/money/${r.key}${asOfQuery}`,
    })),
    { key: "awards", label: "2026 Awards", href: `/dashboard/ceo/money/awards${asOfQuery}` },
  ];

  return (
    <RegionalDashboard
      asOf={asOf}
      pinned={pinned}
      live={register.source === "sheet"}
      sourceLabel={`the accounts workbook (${region.tab})`}
      regions={[regionView]}
      config={ceoConfig}
      accounts={accounts}
      activeAccount={region.key}
      weekNote={weekNote}
    />
  );
}
