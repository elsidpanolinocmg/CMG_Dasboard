import { toEpochDay, type CivilDate } from "@/lib/ceo/week";
import { receivableOwedAt, type RegisterRow } from "./invoice-register";

/**
 * The awards table: every 2026 award, summed over that award's invoices (column F)
 * pooled across every region.
 *
 * Cash and revenue are the whole year to date — total cash collected and total
 * revenue invoiced against the award this calendar year — not a single week, so a
 * row reflects all of the award's activity. Overdue is the 30+‑day balance as of
 * the viewed day, via the same issue-plus-payment reconstruction the overdue chart
 * uses (`overdue-series`).
 */

/** Cancelled and credit-noted rows were never a real receivable or sale. */
const EXCLUDED = new Set(["VOID", "CREDIT_NOTE"]);
const OVERDUE_AFTER_DAYS = 30;
const PAID = "PAID";

export interface AwardRow {
  award: string;
  /** Cash collected this week (SGD). */
  cash: number;
  /** Revenue closed this week (SGD). */
  revenue: number;
  /** Overdue receivables, 30+ days, as of the viewed day (SGD). */
  overdue: number;
  /** Invoice rows behind the award, across all regions. */
  count: number;
}

/** Only awards whose name carries the 2026 event year. */
function is2026(award: string): boolean {
  return /\b2026\b/.test(award);
}

export function buildAwardsTable(rows: RegisterRow[], asOfDate: CivilDate): AwardRow[] {
  const asOf = toEpochDay(asOfDate);
  const year = Number(asOfDate.slice(0, 4));
  const yearStart = toEpochDay(`${year}-01-01`);
  const yearEnd = toEpochDay(`${year}-12-31`);
  const overdueCutoff = asOf - OVERDUE_AFTER_DAYS;

  const byAward = new Map<string, AwardRow>();

  for (const row of rows) {
    const award = row.award;
    if (!award || !is2026(award)) continue;

    let a = byAward.get(award);
    if (!a) {
      a = { award, cash: 0, revenue: 0, overdue: 0, count: 0 };
      byAward.set(award, a);
    }
    a.count++;

    // Revenue invoiced this year: invoices issued in the year, less cancels/credits.
    if (row.day >= yearStart && row.day <= asOf && !EXCLUDED.has(row.status)) {
      a.revenue += row.sgd;
    }

    // Cash collected this year: payments that landed in the year.
    if (row.status === PAID && row.paidOn !== null && row.paidOn >= yearStart && row.paidOn <= asOf) {
      a.cash += row.cashSgd;
    }

    // Overdue 30+ as of the viewed day: issued this year and 30+ days old. The
    // owed amount (paid/unpaid, or a partial "with balance" remainder) comes from
    // the same shared helper the money overdue tile and chart use.
    if (row.day >= yearStart && row.day <= yearEnd && row.day <= overdueCutoff) {
      a.overdue += receivableOwedAt(row, asOf);
    }
  }

  // Biggest overdue first — that is what the table exists to surface — then
  // revenue, then cash, then name for a stable order.
  return [...byAward.values()].sort(
    (x, y) => y.overdue - x.overdue || y.revenue - x.revenue || y.cash - x.cash || x.award.localeCompare(y.award),
  );
}
