import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { getSheetsClient } from "@/lib/sources/googleOAuth";
import { fromEpochDay, parseCivilDate, toEpochDay, type CivilDate, type EpochDay } from "@/lib/ceo/week";

import { generateSampleLedger } from "./sample-data";

/**
 * The invoice register: one row per invoice, read straight from the accounts
 * workbook as it is actually kept.
 *
 * Six columns, and no others:
 *
 *   A  issue date   — a dated cell is what makes the row an invoice
 *   G  currency     — USD or SGD, applies to both K and U
 *   K  gross amount — what was invoiced, before conversion
 *   L  status       — UNPAID / PAID / CANCELLED / CREDIT NOTE
 *   S  payment date — when the bank credited it. Blank until paid.
 *   U  cash received — the bank statement figure. Filled only on PAID rows, and
 *      a little under K, because the transfer costs a few dollars.
 *
 * The two dates do different jobs and must not be confused. Revenue is keyed to
 * A: what did we bill in this week. Cash is keyed to S: what money arrived in
 * this week. Keying cash to A instead would report collections against invoices
 * raised in the week — none of which, in this sheet, are actually paid inside it.
 *
 * This is deliberately separate from `sheets.ts`. That module wants a clean
 * four-tab ledger — invoices, payments, targets, config — which the accounts
 * workbook does not have. The invoiced total needs none of it: it needs a date,
 * an amount, and the currency that amount is denominated in.
 */

/** Sheets serial dates count from 1899-12-30; the Unix epoch sits at 25569. */
const SHEETS_EPOCH_OFFSET = 25569;

/**
 * Column A also carries invoice numbers on some rows (`3290`, `170186`), and
 * blank rows carry nothing. Only a number that lands inside a plausible calendar
 * window is a date. 2000-01-01 through 2099-12-31, in Sheets serial terms.
 */
const MIN_SERIAL = 36526;
const MAX_SERIAL = 73050;

/**
 * Where each field sits, zero-based. The three regional tabs do not agree — SG
 * and ME share a layout, HK is shifted — so the columns are passed in per tab
 * rather than assumed. See `regions.ts`.
 */
export interface ColumnMap {
  issued: number;
  company: number;
  currency: number;
  gross: number;
  status: number;
  paidOn: number;
  cash: number;
  /** The award/event this invoice belongs to (column F in every tab). */
  award: number;
  /**
   * The currency the *payment* was settled in, when the tab records it separately
   * from the invoice currency. A deal billed in USD may be paid in SGD or HKD, so
   * the cash amount must convert at the payment currency, not the invoice one.
   * Absent → assume the cash is in the invoice currency (the old behaviour).
   */
  cashCurrency?: number;
  /**
   * When set, an invoice paid in instalments (several dates + amounts in the cell)
   * is broken into its individual payments, each counted in the week it landed —
   * rather than the whole sum landing in the week of the last instalment.
   */
  splitInstalments?: boolean;
  /**
   * The column holding the per-instalment amounts, when it differs from `cash`
   * (whose column can carry only the total). Paired one-for-one with the payment
   * dates. Falls back to `cash` when absent.
   */
  cashInstalmentAmounts?: number;
  /**
   * When set, an invoice whose status mentions a "balance" (e.g. "PAID WITH
   * BALANCE", "with balance 3 of 4 paid") is treated as partly settled: only its
   * unpaid balance (gross − cash) counts as an overdue receivable, not the whole
   * invoice and not zero. Absent → only strictly `UNPAID` invoices are overdue.
   */
  countBalanceAsOverdue?: boolean;
}

/** The one status whose invoices have actually been collected. */
const PAID = "PAID";

/** The status of an invoice nobody has settled. */
const UNPAID = "UNPAID";

/** Beyond this multiple of its own invoice, a payment is a lump sum, not a payment. */
const OVERSIZED_PAYMENT_RATIO = 3;

/**
 * A cancelled invoice is revenue that evaporated, and a credit note reverses one.
 * Neither belongs in a total of what the week invoiced.
 */
const EXCLUDED_STATUSES = new Set(["CREDIT_NOTE", "VOID"]);

/**
 * Collapses the sheet's free-text status into one of five buckets by its leading
 * word.
 *
 * The status column is hand-typed and has grown a long tail: `PAID WITH BALANCE`,
 * `UNPAID WITH BALANCE`, `PAID WITH OVERPAYMENT`, `CANCELLED <date>`,
 * `WRITE OFF <date>`, `Writen off` (sic). Matching the exact word would drop
 * every one of these — and a `UNPAID WITH BALANCE` row dropped from the overdue
 * figure understates the very thing that tile exists to show.
 *
 * A partial payment (`PAID WITH BALANCE`) is booked to whichever side its leading
 * word names: `PAID` counts its cash, `UNPAID` counts as owed. That is a rough
 * edge — such a row is really both — but it is the rule the business reads off
 * the sheet, and it beats silently discarding the row.
 */
export function normalizeStatus(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s === "") return "";
  if (s.includes("CREDIT NOTE")) return "CREDIT_NOTE";
  if (s.includes("CANCEL") || s.includes("WRIT")) return "VOID"; // WRITE OFF / WRITEN OFF
  if (s.startsWith("UNPAID")) return "UNPAID";
  if (s.startsWith("PAID")) return "PAID";
  return "OTHER";
}

export type RegisterSource = "sheet" | "sample";

export interface RegisterRow {
  /** Column A: the day the invoice was issued. Drives revenue. */
  day: EpochDay;
  /** Column S: the day the bank credited the money. Null until paid. Drives cash. */
  paidOn: EpochDay | null;
  /** Column K, the gross invoiced value, converted to SGD. */
  sgd: number;
  /** Column U, the cash the bank actually credited, converted to SGD. Zero unless PAID. */
  cashSgd: number;
  currency: string;
  status: string;
  /** Column F: the award/event this invoice was raised for. Empty if blank. */
  award: string;
  /**
   * The invoice's cash broken into individual dated payments (reporting currency).
   * A one-off payment is a single entry; an instalment invoice on a split tab has
   * one entry per instalment. Cash-in-a-week is summed from these so each payment
   * counts in the week it landed. `cashSgd` remains the total across them.
   */
  payments: Payment[];
  /**
   * True when this invoice is a partly-settled "with balance" row on a tab that
   * opts in (see `ColumnMap.countBalanceAsOverdue`): overdue counts only its
   * unpaid remainder (gross − payments received), not the whole invoice and not
   * zero. Everything else falls back to the all-or-nothing paid/unpaid rule.
   */
  isBalanceReceivable: boolean;
}

export interface InvoiceRegister {
  rows: RegisterRow[];
  source: RegisterSource;
  /** Which tab it came from, for the banner. */
  tab: string;
  /** SGD per 1 unit, as applied. Shown in the footer so the numbers can be checked. */
  rates: Record<string, number>;
  warnings: string[];
}

type Cell = string | number | boolean | null | undefined;

/** A date, or null. Serial numbers and `YYYY-MM-DD` text both occur in the wild. */
export function cellToIssueDay(cell: Cell): EpochDay | null {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    if (cell < MIN_SERIAL || cell > MAX_SERIAL) return null;
    return Math.round(cell) - SHEETS_EPOCH_OFFSET;
  }
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const day = toEpochDay(trimmed);
    // Round-trip rejects impossible days like 2026-02-30.
    return fromEpochDay(day) === trimmed ? day : null;
  }
  return null;
}

/**
 * A number with an optional thousands separator: `1500`, `1,234.50`, `450.75`.
 * Deliberately anchored so that a comma only groups when three digits follow it
 * — `1500, 20` is two numbers, not `150020`.
 */
const NUMBER_TOKEN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/**
 * The amount in a cell, in its native currency.
 *
 * An invoice settled in instalments is recorded as several numbers in one cell —
 * `"1500\n300"`, `"2000\n450.75"`, `"1500, 20"` — so a cell can hold more than
 * one payment, and the total is their sum.
 *
 * Stripping the separators and parsing what remains would concatenate the digits
 * instead of adding them: `"1500\n300"` becomes 1,500,300, three orders of
 * magnitude out. Every token is therefore matched individually and summed.
 */
export function cellToAmount(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== "string") return null;

  const tokens = cell.match(NUMBER_TOKEN);
  if (!tokens) return null;

  let total = 0;
  for (const token of tokens) {
    const n = Number(token.replace(/,/g, ""));
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}

/** True when a cell holds more than one figure, i.e. the invoice was paid in parts. */
function isMultiValue(cell: Cell): boolean {
  if (typeof cell !== "string") return false;
  return (cell.match(NUMBER_TOKEN) ?? []).length > 1;
}

/**
 * The day an invoice was settled, from column S.
 *
 * Three shapes occur: a Sheets serial, and — because the column is hand-typed —
 * text like `03/19/2026`, and several such dates in one cell when the invoice was
 * paid in instalments. For an instalment row the *last* date is the one taken:
 * that is when the invoice was finally settled, and it is the only date on the
 * row that column U's total can honestly be attributed to.
 */
export function cellToPaymentDay(cell: Cell): EpochDay | null {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    if (cell < MIN_SERIAL || cell > MAX_SERIAL) return null;
    return Math.round(cell) - SHEETS_EPOCH_OFFSET;
  }
  if (typeof cell !== "string") return null;

  let latest: EpochDay | null = null;
  for (const part of cell.split(/[\n,;]+/)) {
    const parsed = parseCivilDate(part.trim());
    if (parsed === null) continue;
    const day = toEpochDay(parsed);
    if (latest === null || day > latest) latest = day;
  }
  return latest;
}

/** Every date in a payment cell, in order (a single serial, or several typed dates). */
function paymentDayList(cell: Cell): EpochDay[] {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    if (cell < MIN_SERIAL || cell > MAX_SERIAL) return [];
    return [Math.round(cell) - SHEETS_EPOCH_OFFSET];
  }
  if (typeof cell !== "string") return [];
  const days: EpochDay[] = [];
  for (const part of cell.split(/[\n,;]+/)) {
    const parsed = parseCivilDate(part.trim());
    if (parsed !== null) days.push(toEpochDay(parsed));
  }
  return days;
}

/** Every amount in a cell, in order. */
function amountList(cell: Cell): number[] {
  if (typeof cell === "number") return Number.isFinite(cell) ? [cell] : [];
  if (typeof cell !== "string") return [];
  const tokens = cell.match(NUMBER_TOKEN);
  if (!tokens) return [];
  const out: number[] = [];
  for (const token of tokens) {
    const n = Number(token.replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** One payment behind an invoice: the day it landed and its value in the reporting currency. */
export interface Payment {
  day: EpochDay;
  amount: number;
}

/**
 * The individual payments behind an invoice, each on its own date and converted at
 * `rate`. When `split` is on and the cell holds several dates matched one-for-one
 * with several amounts (a true instalment), each instalment is returned separately
 * so it counts in the week it actually landed. Otherwise the whole cash is a single
 * payment on the last date — the previous behaviour — which also covers ordinary
 * one-off payments and ambiguous cells (e.g. two dates but one amount).
 */
function cellToPayments(
  dateCell: Cell,
  splitAmountCell: Cell,
  totalAmountCell: Cell,
  rate: number,
  split: boolean,
): Payment[] {
  if (split) {
    const days = paymentDayList(dateCell);
    // The per-instalment amounts live in their own column; the "total" column may
    // hold only the sum. Pair the dates with the per-instalment amounts one-for-one.
    const amounts = amountList(splitAmountCell);
    if (days.length > 1 && days.length === amounts.length) {
      return days.map((day, i) => ({ day, amount: amounts[i] * rate }));
    }
  }
  // One-off, or a row we can't split cleanly: the whole cash on the last date.
  const day = cellToPaymentDay(dateCell);
  const amount = cellToAmount(totalAmountCell);
  if (day === null || amount === null) return [];
  return [{ day, amount: amount * rate }];
}

/**
 * The most recent day an invoice was *issued* — the latest date in column A.
 * Rows dated after `notAfter` are ignored, so a fat-fingered future date can't
 * drag the whole wall into an empty week. Returns null when the register has no
 * usable issue date at all.
 *
 * This is what lets the page track "the latest week on the sheet" instead of the
 * calendar: the week containing this day is the freshest one that billed. Payment
 * dates are deliberately not considered — stragglers paying an old invoice should
 * not advance the reporting week past the last week any business was booked.
 */
export function latestIssueDay(
  register: InvoiceRegister,
  notAfter: EpochDay = Number.POSITIVE_INFINITY,
): EpochDay | null {
  let latest: EpochDay | null = null;
  for (const row of register.rows) {
    if (row.day > notAfter) continue;
    if (latest === null || row.day > latest) latest = row.day;
  }
  return latest;
}

export function countIssuedIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  let count = 0;
  for (const row of register.rows) {
    if (row.day >= start && row.day <= end) count++;
  }
  return count;
}

/**
 * The week's invoiced value, in SGD. Cancelled and credit-noted rows are left
 * out; see `EXCLUDED_STATUSES`.
 */
export function invoicedSgdIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  let total = 0;
  for (const row of register.rows) {
    if (row.day < start || row.day > end) continue;
    if (EXCLUDED_STATUSES.has(row.status)) continue;
    total += row.sgd;
  }
  return total;
}

/**
 * The payments that landed in the window — keyed to column S, the date the bank
 * credited the money, not to the date the invoice was raised.
 */
function paymentsIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): RegisterRow[] {
  return register.rows.filter(
    (row) => row.status === PAID && row.paidOn !== null && row.paidOn >= start && row.paidOn <= end,
  );
}

/**
 * Cash collected: every individual payment that landed in the window, each counted
 * in the week it arrived — so an instalment's earlier parts stay in their own weeks
 * rather than being pulled forward into the week of the final instalment.
 */
export function cashCollectedIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  let total = 0;
  for (const row of register.rows) {
    for (const p of row.payments) {
      if (p.day >= start && p.day <= end) total += p.amount;
    }
  }
  return total;
}

/**
 * Bank transfer fees: what the invoice said (K) less what arrived (U), across the
 * payments that landed in the window. A few dollars each.
 *
 * Only a paid row can say anything about a fee. On an unpaid invoice column U is
 * blank, so `K - U` would come out as the entire invoice — not a fee, just an
 * invoice nobody has settled.
 */
export function bankFeesIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  return paymentsIn(register, start, end).reduce((total, row) => total + (row.sgd - row.cashSgd), 0);
}

/**
 * The cash target: everything the week invoiced, less what the banks took in
 * transit. In other words, the money the week *should* eventually produce.
 *
 *     target = tK − tAns
 *
 * where `tK` is the week's revenue — the gross of every invoice it raised — and
 * `tAns` is the sum of `K − U` over the invoices actually settled, which is what
 * the transfers cost.
 *
 * The two terms are drawn from different rows on purpose, and that is what makes
 * the tile mean anything. `tK` counts invoices *issued* in the week; the fee
 * counts payments *received* in it. Compute both from the same rows and the
 * algebra cancels — `ΣK − Σ(K − U) = ΣU` — and the tile reports 100% forever.
 *
 * So the tile answers: are we banking money as fast as we are billing it?
 */
export function cashTargetIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  return invoicedSgdIn(register, start, end) - bankFeesIn(register, start, end);
}

/** How many individual payments landed in the window. */
export function paidCountIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  let n = 0;
  for (const row of register.rows) {
    for (const p of row.payments) {
      if (p.day >= start && p.day <= end) n++;
    }
  }
  return n;
}

/** An invoice is overdue once it is older than this many days. */
const OVERDUE_AFTER_DAYS = 30;

/** 1 January of the year containing `day`. */
function yearStart(day: EpochDay): EpochDay {
  const year = fromEpochDay(day).slice(0, 4);
  return toEpochDay(`${year}-01-01`);
}

/**
 * What an invoice still owes as an overdue receivable, as of `asOf`, in the
 * reporting currency — before any year/age filter the caller applies. Shared by
 * the overdue figure and the YTD chart so the two never disagree.
 *
 *   · A void or credit note owes nothing.
 *   · A "with balance" row owes gross minus the payments received by `asOf`, so
 *     its balance shrinks month by month as instalments land.
 *   · Every other row is all-or-nothing: its whole gross if it had not been paid
 *     by `asOf`, else zero — which keeps a fully-paid invoice's bank fee (gross
 *     minus a few dollars) from leaking into overdue.
 */
export function receivableOwedAt(row: RegisterRow, asOf: EpochDay): number {
  if (EXCLUDED_STATUSES.has(row.status)) return 0;
  if (row.isBalanceReceivable) {
    let paid = 0;
    for (const p of row.payments) if (p.day <= asOf) paid += p.amount;
    return Math.max(0, row.sgd - paid);
  }
  return row.paidOn === null || row.paidOn > asOf ? row.sgd : 0;
}

/**
 * Overdue receivables: what is still owed on invoices raised this calendar year
 * and now more than 30 days old.
 *
 * Filters on the issue date (column A):
 *   · issued this year — last year's debts are a different conversation
 *   · issued more than 30 days before the week being viewed
 * The owed amount per row (paid/unpaid, or a partial balance) comes from
 * `receivableOwedAt`.
 */
export function overdueReceivablesIn(register: InvoiceRegister, asOf: EpochDay): number {
  const from = yearStart(asOf);
  const cutoff = asOf - OVERDUE_AFTER_DAYS;

  let total = 0;
  for (const row of register.rows) {
    if (row.day < from || row.day >= cutoff) continue;
    total += receivableOwedAt(row, asOf);
  }
  return total;
}

/** How many invoices make up the overdue figure. */
export function overdueCountIn(register: InvoiceRegister, asOf: EpochDay): number {
  const from = yearStart(asOf);
  const cutoff = asOf - OVERDUE_AFTER_DAYS;

  let n = 0;
  for (const row of register.rows) {
    if (row.day < from || row.day >= cutoff) continue;
    if (receivableOwedAt(row, asOf) > 0) n++;
  }
  return n;
}

/**
 * Everything still owed on this year's invoices: the cash that has been billed
 * and has not arrived. This is what the overdue figure is measured against.
 *
 * Paid invoices are excluded, and that is the whole point. Measuring overdue
 * against *all* billing buries it under the money already banked — the bulk of a
 * year's invoices are collected, and counting them would drag the ratio down and
 * flatter a number whose job is to show risk. Credit notes are excluded too: a
 * reversed invoice is not owed.
 *
 * The overdue figure is a subset of this, so the ratio runs 0–100%: of the cash
 * still missing, how much has gone past terms.
 */
export function outstandingThisYearIn(register: InvoiceRegister, asOf: EpochDay): number {
  const from = yearStart(asOf);

  let total = 0;
  for (const row of register.rows) {
    if (row.day < from || row.day > asOf) continue;
    if (row.status !== UNPAID) continue;
    total += row.sgd;
  }
  return total;
}

/**
 * The non-SGD rates actually applied inside the window, so the footer can state
 * them. Listing the whole table would name currencies the week never saw.
 */
export function ratesUsedIn(
  register: InvoiceRegister,
  start: EpochDay,
  end: EpochDay,
): Array<[string, number]> {
  const seen = new Set<string>();
  for (const row of register.rows) {
    // Either date can bring a currency onto the page: an invoice issued this
    // week feeds revenue, a payment received this week feeds cash.
    const issuedHere = row.day >= start && row.day <= end;
    const paidHere = row.paidOn !== null && row.paidOn >= start && row.paidOn <= end;
    if (!issuedHere && !paidHere) continue;
    if (row.currency === "SGD") continue;
    if (register.rates[row.currency] !== undefined) seen.add(row.currency);
  }
  return [...seen].sort().map((code) => [code, register.rates[code]] as [string, number]);
}

/** How many rows in the window were dropped for their status, and what they were worth. */
export function excludedIn(
  register: InvoiceRegister,
  start: EpochDay,
  end: EpochDay,
): { rows: number; sgd: number } {
  let rows = 0;
  let sgd = 0;
  for (const row of register.rows) {
    if (row.day < start || row.day > end) continue;
    if (!EXCLUDED_STATUSES.has(row.status)) continue;
    rows++;
    sgd += row.sgd;
  }
  return { rows, sgd };
}

/**
 * SGD per 1 unit of each currency.
 *
 * Budget rates, set once, not spot: the accounts workbook converts each award at
 * a rate contemporaneous with its event (1.34–1.40 for USD), but a performance
 * dashboard should move when the business moves and not when the currency market
 * does.
 *
 * USD and SGD are effectively all of the register. The rest are rare one-offs (a
 * little AUD, the occasional GBP or EUR), carried here so a week containing one
 * is not silently understated.
 */
export const DEFAULT_RATES: Readonly<Record<string, number>> = {
  SGD: 1,
  USD: 1.35,
  AUD: 0.88,
  GBP: 1.71,
  EUR: 1.46,
  HKD: 0.17,
};

/**
 * `CEO_INVOICE_RATES="USD=1.35,AUD=0.88"` overrides any of the defaults.
 * `CEO_INVOICE_USD_RATE` is still honoured, and wins, so an existing deployment
 * keeps working.
 */
export function loadRates(): Record<string, number> {
  const rates: Record<string, number> = { ...DEFAULT_RATES };

  for (const pair of (process.env.CEO_INVOICE_RATES ?? "").split(",")) {
    const [code, value] = pair.split("=");
    if (!code || !value) continue;
    const rate = Number(value.trim());
    if (Number.isFinite(rate) && rate > 0) rates[code.trim().toUpperCase()] = rate;
  }

  const usd = Number(process.env.CEO_INVOICE_USD_RATE);
  if (Number.isFinite(usd) && usd > 0) rates.USD = usd;

  // SGD is the reporting currency. It is 1 by definition, and letting config say
  // otherwise would silently rescale every figure on the page.
  rates.SGD = 1;

  return rates;
}

/**
 * Direct currency→USD rates, for currencies that convert more accurately straight
 * to USD than via the SGD cross (which multiplies two rates and compounds their
 * error). HKD is pegged to the US dollar, so its true USD rate barely moves while
 * the SGD leg drifts — a direct rate keeps HK figures honest. Where a currency
 * appears here, this value REPLACES the SGD-derived one for both invoice and
 * payment conversion. `CEO_INVOICE_USD_RATES="HKD=0.128"` overrides the defaults.
 */
export const DEFAULT_USD_RATES: Readonly<Record<string, number>> = {
  HKD: 0.127, // ≈ 7.87 HKD per USD (the peg), not the SGD-cross derivation
};

export function loadUsdRates(): Record<string, number> {
  const rates: Record<string, number> = { ...DEFAULT_USD_RATES };

  for (const pair of (process.env.CEO_INVOICE_USD_RATES ?? "").split(",")) {
    const [code, value] = pair.split("=");
    if (!code || !value) continue;
    const rate = Number(value.trim());
    if (Number.isFinite(rate) && rate > 0) rates[code.trim().toUpperCase()] = rate;
  }

  return rates;
}

/**
 * Falls back to the sample ledger when no register sheet is configured, so the
 * page still renders during development. The source is reported to the UI — a
 * demo must never masquerade as a real figure.
 */
export interface RegionSource {
  /** The worksheet tab name. */
  tab: string;
  /** Where each field sits in that tab. */
  columns: ColumnMap;
}

export async function loadInvoiceRegister(
  todayDate: CivilDate,
  source: RegionSource,
): Promise<InvoiceRegister> {
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_invoice_register",
    process.env.CEO_INVOICE_REGISTER_SHEET_ID,
  );
  const { tab, columns: col } = source;
  // Admin-panel rates win over the env var; both fall back to DEFAULT_RATES.
  const { resolveInvoiceRates, resolveUsdRates } = await import("./rates");
  const toSgdRates = await resolveInvoiceRates();

  // The dashboard reports in USD. The configured rates convert each currency TO
  // SGD, so divide them all by the USD→SGD rate to get currency→USD instead:
  // USD passes through 1:1 (most invoices are already USD), while SGD/HKD/… are
  // converted to USD. Every downstream `sgd`/`cashSgd` field is therefore USD.
  const usdPerSgd = toSgdRates.USD && toSgdRates.USD > 0 ? toSgdRates.USD : 1.35;
  const rates: Record<string, number> = {};
  for (const [code, r] of Object.entries(toSgdRates)) rates[code] = r / usdPerSgd;

  // A direct currency→USD rate (e.g. HKD's peg) replaces the SGD-derived one,
  // so a pegged currency isn't knocked off by drift in the SGD cross.
  const usdDirect = await resolveUsdRates();
  for (const [code, r] of Object.entries(usdDirect)) rates[code] = r;

  if (!spreadsheetId) {
    const sample = generateSampleLedger(todayDate);
    return {
      rows: sample.invoices.map((i) => {
        const sgd = i.amount * (rates[i.currency] ?? 1);
        const paid = i.status === "paid";
        const payment = sample.payments.find((p) => p.invoiceNo === i.invoiceNo);
        const paidOn = payment ? toEpochDay(payment.paidDate) : null;
        // A plausible bank fee, so the sample tile behaves like the real one.
        const cashSgd = paid ? sgd - 10 : 0;
        return {
          day: toEpochDay(i.issueDate),
          paidOn,
          sgd,
          cashSgd,
          currency: i.currency,
          status: paid ? "PAID" : i.status === "void" ? "VOID" : "UNPAID",
          award: "",
          payments: paidOn !== null ? [{ day: paidOn, amount: cashSgd }] : [],
          isBalanceReceivable: false,
        };
      }),
      source: "sample",
      tab: "sample data",
      rates,
      warnings: [],
    };
  }

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A:U`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const raw = (response.data.values as Cell[][] | undefined) ?? [];

  const rows: RegisterRow[] = [];
  const unknownCurrencies = new Map<string, number>();
  let missingAmounts = 0;
  let otherStatuses = 0;
  let paidWithoutCash = 0;
  let paidWithoutDate = 0;
  let instalments = 0;

  for (const line of raw) {
    const day = cellToIssueDay(line[col.issued]);
    if (day === null) continue; // not an invoice row: header, total, or blank

    const currency = String(line[col.currency] ?? "").trim().toUpperCase();
    const gross = cellToAmount(line[col.gross]);
    const cash = cellToAmount(line[col.cash]);
    const paidOn = cellToPaymentDay(line[col.paidOn]);
    const rawStatus = String(line[col.status] ?? "");
    const status = normalizeStatus(rawStatus);
    const award = String(line[col.award] ?? "").trim();

    // A payment marked "PAID for confirmation" (or similar) has been recorded but
    // not yet confirmed collected, so it must not count as cash until it clears.
    const unconfirmed = /confirmation/i.test(rawStatus);

    if (status === "OTHER") otherStatuses++;

    // Paid in parts. The cash is the sum of the instalments, and it is credited
    // to the week the last one landed — the only date the total can be pinned to.
    if (isMultiValue(line[col.cash]) || isMultiValue(line[col.paidOn])) instalments++;

    // A blank currency on this sheet means SGD, the reporting currency.
    const code = currency === "" ? "SGD" : currency;
    const rate = rates[code];

    if (rate === undefined) {
      // Never guess. An unrecognised currency contributes nothing and is
      // reported — silently treating HKD as SGD would overstate it six-fold.
      unknownCurrencies.set(code, (unknownCurrencies.get(code) ?? 0) + 1);
      // Unknown currency: the amount can't be converted, so it's zeroed and owes
      // nothing to the overdue figure either.
      rows.push({ day, paidOn, sgd: 0, cashSgd: 0, currency: code, status, award, payments: [], isBalanceReceivable: false });
      continue;
    }

    if (gross === null) {
      // A dated row with no amount is still an invoice; it just adds nothing.
      missingAmounts++;
    }

    // Cash is keyed to the payment date, so a paid invoice missing either its
    // amount or its date is money the dashboard cannot place in a week.
    if (status === PAID && cash === null) paidWithoutCash++;
    if (status === PAID && paidOn === null) paidWithoutDate++;

    // The gross converts at the invoice currency. The cash may have been settled
    // in a different currency (billed USD, paid SGD/HKD), so when the tab records
    // a payment currency, convert the cash at THAT rate; otherwise fall back to
    // the invoice currency. An unrecognised payment currency falls back too,
    // rather than zeroing money that was genuinely collected.
    const cashCode =
      col.cashCurrency !== undefined
        ? String(line[col.cashCurrency] ?? "").trim().toUpperCase() || code
        : code;
    const cashRate = rates[cashCode] ?? rate;
    const splitAmountCell = col.cashInstalmentAmounts !== undefined ? line[col.cashInstalmentAmounts] : line[col.cash];
    const payments = unconfirmed
      ? []
      : cellToPayments(line[col.paidOn], splitAmountCell, line[col.cash], cashRate, !!col.splitInstalments);

    // A "with balance" row (on a tab that opts in) is treated as partly settled:
    // overdue counts only its unpaid remainder. Void/credit notes never qualify.
    const isBalanceReceivable =
      !EXCLUDED_STATUSES.has(status) && !!col.countBalanceAsOverdue && /balance/i.test(rawStatus);

    rows.push({
      day,
      paidOn,
      sgd: (gross ?? 0) * rate,
      cashSgd: (cash ?? 0) * cashRate,
      currency: code,
      status,
      award,
      payments,
      isBalanceReceivable,
    });
  }

  const warnings: string[] = [];
  if (rows.length === 0) {
    warnings.push(`No dated rows in "${tab}" — is the tab name right?`);
  }
  for (const [currency, n] of unknownCurrencies) {
    warnings.push(`${n} row${n === 1 ? "" : "s"} in "${tab}" use ${currency}, which has no rate — counted as zero`);
  }
  if (missingAmounts > 0) {
    warnings.push(`${missingAmounts} dated row${missingAmounts === 1 ? "" : "s"} in "${tab}" have no invoice amount`);
  }
  if (otherStatuses > 0) {
    warnings.push(
      `${otherStatuses} row${otherStatuses === 1 ? " has" : "s have"} a status in "${tab}" that is neither paid, unpaid, cancelled nor credited — not counted as cash or overdue`,
    );
  }
  // Cash is read from the bank-statement amount, so a paid invoice with an empty
  // one is money the dashboard cannot see. It would quietly understate the week.
  if (paidWithoutCash > 0) {
    warnings.push(
      `${paidWithoutCash} paid invoice${paidWithoutCash === 1 ? "" : "s"} in "${tab}" have no cash amount recorded`,
    );
  }
  // Without a payment date there is no week to put the money in, so it vanishes
  // from every cash figure. Silent, and it always understates.
  if (paidWithoutDate > 0) {
    warnings.push(
      `${paidWithoutDate} paid invoice${paidWithoutDate === 1 ? "" : "s"} in "${tab}" have no payment date — their cash is not counted in any week`,
    );
  }
  if (instalments > 0) {
    warnings.push(
      `${instalments} invoice${instalments === 1 ? " was" : "s were"} paid in instalments; each is counted in full in the week its last payment landed`,
    );
  }
  // A payment far larger than the invoice it sits against is a lump-sum transfer
  // covering several invoices, booked to one row. The cash is real, but it is
  // attributed to a single week — so it belongs in the open, not buried.
  const oversized = rows.filter((r) => r.sgd > 0 && r.cashSgd > r.sgd * OVERSIZED_PAYMENT_RATIO).length;
  if (oversized > 0) {
    warnings.push(
      `${oversized} payment${oversized === 1 ? "" : "s"} in "${tab}" far exceed the invoice they are booked against — likely a lump sum covering several invoices`,
    );
  }

  return { rows, source: "sheet", tab, rates, warnings };
}
