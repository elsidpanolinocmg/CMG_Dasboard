import { AwardsDashboard } from "@/components/ceo/AwardsDashboard";
import { cacheKeys, getCache } from "@/lib/cache";
import { fromEpochDay, parseCivilDate, today, toEpochDay } from "@/lib/ceo/week";
import { buildAwardsTable } from "@/lib/ceo-money/awards";
import { loadRegionRegister } from "@/lib/ceo-money/cached-register";
import type { InvoiceRegister, RegisterRow } from "@/lib/ceo-money/invoice-register";
import { formatBusinessWeek, reportingWeekFor } from "@/lib/ceo-money/reporting-week";
import { REGIONS } from "@/lib/ceo-money/regions";

// The reporting week rolls at Singapore midnight, so this page must never be
// statically rendered.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = {
  title: "2026 Awards — CMG Dashboard",
};

/** A pinned week from `?asOf=` or `CEO_MONEY_AS_OF`; else null and we follow the sheet. */
function explicitAsOf(raw: string | string[] | undefined): { asOf: string; pinned: boolean } | null {
  const now = today();
  const requested =
    parseCivilDate(Array.isArray(raw) ? raw[0] : raw) ?? parseCivilDate(process.env.CEO_MONEY_AS_OF);
  if (requested === null) return null;

  const asOf = toEpochDay(requested) > toEpochDay(now) ? now : requested;
  return { asOf, pinned: asOf !== now };
}

export default async function CeoAwardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const explicit = explicitAsOf(params.asOf);
  // Award figures are year-to-date; the reporting week only sets the overdue
  // "as of" date. It's the same Mon–Fri, one-week-arrears window the regions use.
  const rw = reportingWeekFor(today());
  const asOf = explicit?.asOf ?? fromEpochDay(rw.end);
  const pinned = explicit?.pinned ?? false;
  const cacheDate = asOf;

  if (params.cache === "clear") {
    try {
      await Promise.all(REGIONS.map((r) => getCache().invalidate(cacheKeys.ceoInvoiceRegister(cacheDate, r.key))));
    } catch (err) {
      console.error("[ceo-awards] cache invalidate failed:", err);
    }
  }

  // Every region reads independently; one failing tab degrades to no rows for that
  // region rather than taking the page down.
  const registers = await Promise.all(
    REGIONS.map(async (region) => {
      try {
        return await loadRegionRegister(region, cacheDate);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ceo-awards] ${region.tab} unreadable:`, err);
        const empty: InvoiceRegister = {
          rows: [],
          source: "sample",
          tab: region.tab,
          rates: {},
          warnings: [`Could not read ${region.tab}: ${message}`],
        };
        return empty;
      }
    }),
  );

  const rows: RegisterRow[] = registers.flatMap((r) => r.rows);
  const live = registers.some((r) => r.source === "sheet");
  const warnings = registers.flatMap((r) => r.warnings);

  const awards = buildAwardsTable(rows, asOf);
  const weekText = formatBusinessWeek(fromEpochDay(rw.labelStart), fromEpochDay(rw.labelEnd));

  const accounts = [
    { key: "all", label: "All Regions", href: "/dashboard/ceo/money" },
    { key: "awards", label: "2026 Awards", href: "/dashboard/ceo/money/awards" },
  ];

  return (
    <AwardsDashboard
      awards={awards}
      weekText={weekText}
      pinned={pinned}
      live={live}
      warnings={warnings}
      accounts={accounts}
    />
  );
}
