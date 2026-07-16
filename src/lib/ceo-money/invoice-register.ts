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

/** Cash collected: column U, totalled over the payments that arrived in the window. */
export function cashCollectedIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  return paymentsIn(register, start, end).reduce((total, row) => total + row.cashSgd, 0);
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

/** How many payments landed in the window. */
export function paidCountIn(register: InvoiceRegister, start: EpochDay, end: EpochDay): number {
  return paymentsIn(register, start, end).length;
}

/** An invoice is overdue once it is older than this many days. */
const OVERDUE_AFTER_DAYS = 30;

/** 1 January of the year containing `day`. */
function yearStart(day: EpochDay): EpochDay {
  const year = fromEpochDay(day).slice(0, 4);
  return toEpochDay(`${year}-01-01`);
}

/**
 * Overdue receivables: what is still owed on invoices raised this calendar year
 * and now more than 30 days old.
 *
 * Three filters, all on column A and column L:
 *   · issued this year — last year's debts are a different conversation
 *   · issued more than 30 days before the week being viewed
 *   · still UNPAID — a paid invoice is not a receivable, and an invoice raised
 *     after the week being viewed has not happened yet
 */
export function overdueReceivablesIn(register: InvoiceRegister, asOf: EpochDay): number {
  const from = yearStart(asOf);
  const cutoff = asOf - OVERDUE_AFTER_DAYS;

  let total = 0;
  for (const row of register.rows) {
    if (row.day < from || row.day >= cutoff) continue;
    if (row.status !== UNPAID) continue;
    total += row.sgd;
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
    if (row.status === UNPAID) n++;
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
  const spreadsheetId = process.env.CEO_INVOICE_REGISTER_SHEET_ID;
  const { tab, columns: col } = source;
  const rates = loadRates();

  if (!spreadsheetId) {
    const sample = generateSampleLedger(todayDate);
    return {
      rows: sample.invoices.map((i) => {
        const sgd = i.amount * (rates[i.currency] ?? 1);
        const paid = i.status === "paid";
        const payment = sample.payments.find((p) => p.invoiceNo === i.invoiceNo);
        return {
          day: toEpochDay(i.issueDate),
          paidOn: payment ? toEpochDay(payment.paidDate) : null,
          sgd,
          // A plausible bank fee, so the sample tile behaves like the real one.
          cashSgd: paid ? sgd - 10 : 0,
          currency: i.currency,
          status: paid ? "PAID" : i.status === "void" ? "VOID" : "UNPAID",
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
    const status = normalizeStatus(String(line[col.status] ?? ""));

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
      rows.push({ day, paidOn, sgd: 0, cashSgd: 0, currency: code, status });
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

    // The cash column carries the same currency as the gross — the bank statement
    // is in the currency the invoice was billed in.
    rows.push({
      day,
      paidOn,
      sgd: (gross ?? 0) * rate,
      cashSgd: (cash ?? 0) * rate,
      currency: code,
      status,
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
