import { fromEpochDay, toEpochDay, type CivilDate, type EpochDay } from "@/lib/ceo/week";
import { receivableOwedAt, type InvoiceRegister, type RegisterRow } from "./invoice-register";

/**
 * The overdue-receivables balance tracked across the year — the data behind the
 * YTD chart.
 *
 * Because every invoice in the register carries both its issue date and (when
 * settled) its payment date, the balance can be reconstructed as of any past
 * day: an invoice is overdue on day D if it was issued this year, is more than
 * 30 days old on D, and had not been paid on or before D. The current year's
 * line runs to the day being viewed ("as of now"); the prior year's runs its
 * full length as an overlay.
 */

const OVERDUE_AFTER_DAYS = 30;

export interface OverduePoint {
  /** Position through the year, 0 (Jan 1) to 1 (Dec 31), so two years align. */
  frac: number;
  /** The month this point sits in, 1–12, for axis labelling. */
  month: number;
  /** SGD overdue on that day. */
  value: number;
}

export interface OverdueSeries {
  /** Overdue balance as of the viewed day. */
  current: number;
  /** The invented ceiling drawn as the target line. */
  target: number;
  /** The rolling 4-month window (present + prior 3), closing on the viewed day. */
  thisYear: OverduePoint[];
  /** The same 4 months of the prior year, for a like-for-like overlay. */
  priorYear: OverduePoint[];
  /** The balance entering the window (frac 0, left edge), so the line flows in
   *  from the left as if continuing from earlier months. Drawn, not labelled. */
  thisYearLead: OverduePoint;
  priorYearLead: OverduePoint;
  thisYearLabel: string;
  priorYearLabel: string;
}

/** Overdue on day `asOf`, among invoices issued in `year`, in reporting currency. */
function overdueAt(rows: RegisterRow[], asOf: EpochDay, year: number): number {
  const yearStart = toEpochDay(`${year}-01-01`);
  const yearEnd = toEpochDay(`${year}-12-31`);

  let total = 0;
  for (const row of rows) {
    if (row.day < yearStart || row.day > yearEnd) continue;
    if (row.day > asOf - OVERDUE_AFTER_DAYS) continue; // not yet 30 days old
    // Paid/unpaid, exclusions and partial "with balance" remainders all live in
    // the shared helper, so this line matches the overdue tile exactly.
    total += receivableOwedAt(row, asOf);
  }
  return total;
}

/** How many months the chart shows: the current month plus the prior three. */
const WINDOW_MONTHS = 4;

const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const dayOf = (year: number, month: number, day: number): EpochDay =>
  toEpochDay(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

/**
 * One year's overdue line across the window's months. Each month is plotted at
 * the centre of its equal share of the width (`(i + 0.5) / n`), so the line
 * points sit directly above the month labels on the axis and both years align
 * month-for-month. The closing month uses the viewed day's balance (this year)
 * or its equivalent date last year; earlier months use their month-end balance.
 */
function windowedLine(
  rows: RegisterRow[],
  year: number,
  months: number[],
  closeDay: EpochDay,
  closeMonth: number,
): OverduePoint[] {
  const n = months.length;
  return months.map((m, i) => {
    const day = m === closeMonth ? closeDay : dayOf(year, m, lastDayOfMonth(year, m));
    return { frac: (i + 0.5) / n, month: m, value: overdueAt(rows, day, year) };
  });
}

export function buildOverdueSeries(
  register: InvoiceRegister,
  asOfDate: CivilDate,
  target: number,
): OverdueSeries {
  const asOf = toEpochDay(asOfDate);
  const year = Number(asOfDate.slice(0, 4));
  const priorYear = year - 1;
  const asOfMonth = Number(asOfDate.slice(5, 7));
  const asOfDay = Number(asOfDate.slice(8, 10));

  // The window is the current month and the three before it, clamped to January.
  const startMonth = Math.max(1, asOfMonth - (WINDOW_MONTHS - 1));
  const months: number[] = [];
  for (let m = startMonth; m <= asOfMonth; m++) months.push(m);

  const thisYear = windowedLine(register.rows, year, months, asOf, asOfMonth);

  // The prior year over the same months, closing on the equivalent date, so the
  // overlay is a like-for-like comparison rather than the whole of last year.
  const priorCloseDayNum = Math.min(asOfDay, lastDayOfMonth(priorYear, asOfMonth));
  const priorClose = dayOf(priorYear, asOfMonth, priorCloseDayNum);
  const prior = windowedLine(register.rows, priorYear, months, priorClose, asOfMonth);

  // The balance on the day before the window opens — the line's left-edge anchor,
  // so each year's line enters from the left rather than starting mid-plot.
  const lead = (y: number): OverduePoint => ({
    frac: 0,
    month: startMonth,
    value: overdueAt(register.rows, dayOf(y, startMonth, 1) - 1, y),
  });

  return {
    current: overdueAt(register.rows, asOf, year),
    target,
    thisYear,
    priorYear: prior,
    thisYearLead: lead(year),
    priorYearLead: lead(priorYear),
    thisYearLabel: String(year),
    priorYearLabel: String(priorYear),
  };
}
