import type { ColumnMap } from "./invoice-register";

/**
 * The regional invoice registers, each a tab in the one accounts workbook, and
 * each now its own dashboard page (SG / HK / ME).
 *
 * The tabs do not share a column layout. SG and ME line up; HK is shifted —
 * currency, gross, status, payment date and cash all sit two-to-five columns to
 * the left of where SG keeps them. These maps were read off the actual data
 * rows, not the header, because HK's header row is itself misaligned from its
 * data. Changing them means re-probing the sheet.
 */

/** SG Accounts and ME Accounts: A / C / F / G / K / L / S / U. */
const STANDARD_COLUMNS: ColumnMap = {
  issued: 0, // A
  company: 2, // C
  award: 5, // F
  currency: 6, // G
  gross: 10, // K
  status: 11, // L
  paidOn: 18, // S
  cash: 20, // U
};

/**
 * SG's payment block records the currency the payment was received in (column T),
 * separate from the invoice currency (G) — many USD invoices are settled in SGD.
 * So SG converts cash at column T.
 */
const SG_COLUMNS: ColumnMap = {
  ...STANDARD_COLUMNS,
  cashCurrency: 19, // T
  splitInstalments: true,
  cashInstalmentAmounts: 17, // R — per-instalment amounts (U can hold only the total)
  countBalanceAsOverdue: true, // "with balance" rows owe only their unpaid remainder
};

/**
 * ME shares SG's base layout and, like SG, records the payment currency in
 * column T (a handful of USD invoices are settled in SGD). Its instalment dates
 * live in a free-text column that can't be split cleanly, and it has no "with
 * balance" statuses, so only the payment-currency conversion carries over.
 */
const ME_COLUMNS: ColumnMap = {
  ...STANDARD_COLUMNS,
  cashCurrency: 19, // T — the currency the payment was received in
};

/**
 * HK Accounts: A / C / F / H / I / J / K / P, with the payment currency in
 * column O. Like SG, HK sometimes bills in one currency and is paid in another
 * (a USD invoice settled in HKD, or the reverse), so cash converts at O, not the
 * invoice currency H. Instalments here are recorded as free-text in the date
 * column ("8.21 10k | 8.23 10k"), which can't be split cleanly, so they're left
 * as a single payment on the first date.
 */
const HK_COLUMNS: ColumnMap = {
  issued: 0, // A
  company: 2, // C
  award: 5, // F
  currency: 7, // H
  gross: 8, // I
  status: 9, // J
  paidOn: 10, // K
  cash: 15, // P
  cashCurrency: 14, // O — the currency the payment was received in
};

export interface Region {
  key: string;
  /** Shown above the region's cards and in the account nav. */
  label: string;
  /** The worksheet tab it reads from. */
  tab: string;
  columns: ColumnMap;
  /**
   * Weekly revenue target, in USD. INVENTED placeholders, scaled to each
   * region's rough billing volume so the bullet lands in a readable band —
   * nobody has agreed them. SG bills the most, HK less, ME least.
   */
  revenueTarget: number;
  /**
   * The ceiling the overdue-receivables balance should stay under, in USD, drawn
   * as the target line on the YTD chart. Also INVENTED — set a little below where
   * each region's balance has typically sat, as a stretch, until a real one is
   * agreed. Scaled to the region like the revenue target.
   */
  overdueTarget: number;
}

export const REGIONS: Region[] = [
  {
    key: "sg",
    label: "Singapore",
    tab: "SG Accounts",
    columns: SG_COLUMNS,
    revenueTarget: 750_000,
    overdueTarget: 600_000,
  },
  {
    key: "hk",
    label: "Hong Kong",
    tab: "HK Accounts",
    columns: HK_COLUMNS,
    revenueTarget: 300_000,
    overdueTarget: 240_000,
  },
  {
    key: "me",
    label: "Middle East",
    tab: "ME Accounts",
    columns: ME_COLUMNS,
    revenueTarget: 110_000,
    overdueTarget: 90_000,
  },
];

/** The region for an account key (`sg` / `hk` / `me`), or undefined if unknown. */
export function getRegion(key: string): Region | undefined {
  return REGIONS.find((r) => r.key === key);
}
