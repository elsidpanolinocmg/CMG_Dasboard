import type { ColumnMap } from "./invoice-register";

/**
 * The regional invoice registers, each a tab in the one accounts workbook.
 *
 * The tabs do not share a column layout. SG and ME line up; HK is shifted —
 * currency, gross, status, payment date and cash all sit two-to-five columns to
 * the left of where SG keeps them. These maps were read off the actual data
 * rows, not the header, because HK's header row is itself misaligned from its
 * data. Changing them means re-probing the sheet.
 */

/** SG Accounts and ME Accounts: A / G / K / L / S / U. */
const STANDARD_COLUMNS: ColumnMap = {
  issued: 0, // A
  company: 2, // C
  currency: 6, // G
  gross: 10, // K
  status: 11, // L
  paidOn: 18, // S
  cash: 20, // U
};

/** HK Accounts: A / H / I / J / K / P. */
const HK_COLUMNS: ColumnMap = {
  issued: 0, // A
  company: 2, // C
  currency: 7, // H
  gross: 8, // I
  status: 9, // J
  paidOn: 10, // K
  cash: 15, // P
};

export interface Region {
  key: string;
  /** Shown above the region's cards. */
  label: string;
  /** The worksheet tab it reads from. */
  tab: string;
  columns: ColumnMap;
  /**
   * Weekly revenue target, in SGD. INVENTED placeholders, scaled to each
   * region's rough billing volume so the bullet lands in a readable band —
   * nobody has agreed them. SG bills ~S$1M/week, HK ~S$400K, ME ~S$150K.
   */
  revenueTarget: number;
}

export const REGIONS: Region[] = [
  { key: "sg", label: "Singapore", tab: "SG Accounts", columns: STANDARD_COLUMNS, revenueTarget: 1_000_000 },
  { key: "hk", label: "Hong Kong", tab: "HK Accounts", columns: HK_COLUMNS, revenueTarget: 400_000 },
  { key: "me", label: "Middle East", tab: "ME Accounts", columns: STANDARD_COLUMNS, revenueTarget: 150_000 },
];
