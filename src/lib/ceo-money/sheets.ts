import { getSheetsClient } from "@/lib/sources/googleOAuth";

import { DEFAULT_CONFIG } from "./config";
import { fromEpochDay } from "./date";
import type { Ledger } from "./metrics";
import { generateSampleLedger } from "./sample-data";
import type {
  CivilDate,
  Currency,
  DashboardConfig,
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  Target,
} from "./types";

const TABS = ["Invoices", "Payments", "Targets", "Config"] as const;

export type LedgerSource = "sheet" | "sample";

export interface LoadedLedger {
  ledger: Ledger;
  source: LedgerSource;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Cell coercion
// ---------------------------------------------------------------------------

type Cell = string | number | boolean | null | undefined;

/** Sheets serial dates count from 1899-12-30; the Unix epoch sits at 25569. */
const SHEETS_EPOCH_OFFSET = 25569;

function cellToDate(cell: Cell): CivilDate | null {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return fromEpochDay(Math.round(cell) - SHEETS_EPOCH_OFFSET);
  }
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return null;
}

function cellToNumber(cell: Cell): number | null {
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  if (typeof cell === "string") {
    const cleaned = cell.replace(/[,\s]/g, "").replace(/^(S\$|US\$|HK\$|\$)/i, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function cellToString(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

const CURRENCIES: Currency[] = ["USD", "SGD", "HKD"];
const STATUSES: InvoiceStatus[] = ["draft", "open", "paid", "void"];
const METHODS: PaymentMethod[] = ["bank", "stripe", "paypal", "cash", "other"];

// ---------------------------------------------------------------------------
// Header-driven row mapping
// ---------------------------------------------------------------------------

/** Column order in the sheet is the user's business, not ours. Map by header. */
function toRecords(rows: Cell[][]): Array<Record<string, Cell>> {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => cellToString(h).toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((row) => {
    const record: Record<string, Cell> = {};
    headers.forEach((header, i) => {
      if (header) record[header] = row[i];
    });
    return record;
  });
}

function isBlankRow(record: Record<string, Cell>): boolean {
  return Object.values(record).every((v) => cellToString(v) === "");
}

function parseInvoices(rows: Cell[][], warnings: string[]): Invoice[] {
  const invoices: Invoice[] = [];

  toRecords(rows).forEach((record, i) => {
    if (isBlankRow(record)) return;
    const line = i + 2;

    const invoiceNo = cellToString(record.invoice_no);
    const customer = cellToString(record.customer);
    const issueDate = cellToDate(record.issue_date);
    const dueDate = cellToDate(record.due_date);
    const amount = cellToNumber(record.amount);
    const currency = cellToString(record.currency).toUpperCase() as Currency;
    const rawStatus = cellToString(record.status).toLowerCase();
    const status = (rawStatus || "open") as InvoiceStatus;

    if (!invoiceNo) return void warnings.push(`Invoices row ${line}: missing invoice_no`);
    if (!issueDate) return void warnings.push(`Invoices row ${line}: bad issue_date`);
    if (!dueDate) return void warnings.push(`Invoices row ${line}: bad due_date`);
    if (amount === null) return void warnings.push(`Invoices row ${line}: bad amount`);
    if (!CURRENCIES.includes(currency)) {
      return void warnings.push(`Invoices row ${line}: unknown currency "${currency}"`);
    }
    if (!STATUSES.includes(status)) {
      return void warnings.push(`Invoices row ${line}: unknown status "${status}"`);
    }

    invoices.push({
      invoiceNo,
      customer: customer || "(unnamed)",
      issueDate,
      dueDate,
      currency,
      amount,
      status,
    });
  });

  return invoices;
}

function parsePayments(rows: Cell[][], warnings: string[]): Payment[] {
  const payments: Payment[] = [];

  toRecords(rows).forEach((record, i) => {
    if (isBlankRow(record)) return;
    const line = i + 2;

    const invoiceNo = cellToString(record.invoice_no);
    const paidDate = cellToDate(record.paid_date);
    const amount = cellToNumber(record.amount);
    const currency = cellToString(record.currency).toUpperCase() as Currency;
    const rawMethod = cellToString(record.method).toLowerCase();
    const method = (rawMethod || "other") as PaymentMethod;

    if (!invoiceNo) return void warnings.push(`Payments row ${line}: missing invoice_no`);
    if (!paidDate) return void warnings.push(`Payments row ${line}: bad paid_date`);
    if (amount === null) return void warnings.push(`Payments row ${line}: bad amount`);
    if (!CURRENCIES.includes(currency)) {
      return void warnings.push(`Payments row ${line}: unknown currency "${currency}"`);
    }

    payments.push({
      invoiceNo,
      paidDate,
      currency,
      amount,
      method: METHODS.includes(method) ? method : "other",
    });
  });

  return payments;
}

function parseTargets(rows: Cell[][], warnings: string[]): Target[] {
  const targets: Target[] = [];

  toRecords(rows).forEach((record, i) => {
    if (isBlankRow(record)) return;
    const periodStart = cellToDate(record.period_start);
    if (!periodStart) return void warnings.push(`Targets row ${i + 2}: bad period_start`);

    targets.push({
      periodStart,
      cashTarget: cellToNumber(record.cash_target),
      revenueTarget: cellToNumber(record.revenue_target),
    });
  });

  return targets;
}

/** `Config` is two columns, `key` and `value`. Anything absent keeps its default. */
function parseConfig(rows: Cell[][]): DashboardConfig {
  const settings = new Map<string, number>();
  for (const record of toRecords(rows)) {
    const key = cellToString(record.key).toLowerCase();
    const value = cellToNumber(record.value);
    if (key && value !== null) settings.set(key, value);
  }

  const pick = (key: string, fallback: number) => settings.get(key) ?? fallback;

  return {
    budgetRates: {
      SGD: 1,
      USD: pick("usd_rate", DEFAULT_CONFIG.budgetRates.USD),
      HKD: pick("hkd_rate", DEFAULT_CONFIG.budgetRates.HKD),
    },
    arWarningGrowth: pick("ar_warning_growth", DEFAULT_CONFIG.arWarningGrowth),
    arCriticalGrowth: pick("ar_critical_growth", DEFAULT_CONFIG.arCriticalGrowth),
    arGuardrailFraction: pick("ar_guardrail_fraction", DEFAULT_CONFIG.arGuardrailFraction),
    targetGreenAt: pick("target_green_at", DEFAULT_CONFIG.targetGreenAt),
    targetAmberAt: pick("target_amber_at", DEFAULT_CONFIG.targetAmberAt),
    overdueGreenAt: pick("overdue_green_at", DEFAULT_CONFIG.overdueGreenAt),
    overdueAmberAt: pick("overdue_amber_at", DEFAULT_CONFIG.overdueAmberAt),
  };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Reads all four tabs in one round trip.
 *
 * `UNFORMATTED_VALUE` + `SERIAL_NUMBER` are deliberate. The app's shared
 * `readSheet()` helper returns formatted strings, which would hand us whatever
 * date format the sheet happens to display — `12/06/2026` is ambiguous between
 * June and December. Serial numbers are unambiguous, and `cellToDate` still
 * accepts plain `YYYY-MM-DD` text for anyone who types dates as strings.
 */
async function fetchTabs(spreadsheetId: string): Promise<Cell[][][]> {
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: TABS.map((tab) => `${tab}!A:Z`),
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const ranges = response.data.valueRanges ?? [];
  return TABS.map((_, i) => (ranges[i]?.values as Cell[][] | undefined) ?? []);
}

/**
 * Reads the sheet when `CEO_MONEY_SHEET_ID` is set, and otherwise falls back to
 * deterministic sample data so the page renders during development. The source
 * is reported to the UI — a demo must never masquerade as real money.
 *
 * Authentication piggybacks on the app's existing Google OAuth refresh token,
 * so no new credentials are needed. The Google account behind that token must
 * be able to open the spreadsheet.
 */
export async function loadLedger(todayDate: string): Promise<LoadedLedger> {
  const spreadsheetId = process.env.CEO_MONEY_SHEET_ID;
  if (!spreadsheetId) {
    return { ledger: generateSampleLedger(todayDate), source: "sample", warnings: [] };
  }

  const warnings: string[] = [];
  const [invoiceRows, paymentRows, targetRows, configRows] = await fetchTabs(spreadsheetId);

  const ledger: Ledger = {
    invoices: parseInvoices(invoiceRows, warnings),
    payments: parsePayments(paymentRows, warnings),
    targets: parseTargets(targetRows, warnings),
    config: parseConfig(configRows),
  };

  return { ledger, source: "sheet", warnings };
}
