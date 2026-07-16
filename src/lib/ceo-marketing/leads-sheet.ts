import { getSheetsClient } from "@/lib/sources/googleOAuth";
import { fromEpochDay, toEpochDay, weekStart, type CivilDate, type EpochDay } from "@/lib/ceo/week";

/**
 * Reads paid leads from the "Campaigns Report + Analysis" workbook, tab
 * "Weekly Overall Report".
 *
 * That tab is a stack of Friday–Thursday weekly blocks. Each block holds several
 * side-by-side report sections (main ad campaigns, sponsorships, sales), and each
 * section carries its own "Weekly Total Leads" cell.
 *
 * Leads generated is the sum of the sections' lead totals. Cost per lead is the
 * simple average of the sections' own CPL figures (the "CPL" cell below each
 * "Weekly Total Leads") — not a volume-weighted blend. That is the definition
 * the business reads off the sheet.
 *
 * The CPL figures are taken as SGD and shown as-is, with no conversion — the
 * sheet already keeps them in the reporting currency.
 */

const TAB = "Weekly Overall Report";

/** The label beside each section's weekly lead total. */
const LEADS_LABEL = /^weekly total leads$/i;

/** The label beside each section's weekly cost per lead. */
const CPL_LABEL = /^cpl$/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface WeeklyLeads {
  /** Total leads for the matched week, or null when no block matches. */
  leads: number | null;
  /** Average of the sections' cost per lead, or null when none is available. */
  cpl: number | null;
  /** The block's own label, e.g. "Jun 26 - Jul 2, 2026". */
  weekLabel: string | null;
  /** How many section lead totals were summed. */
  sections: number;
  source: "sheet" | "none";
  warnings: string[];
}

/**
 * Parses a block header like `Jun 26 - Jul 2, 2026` into its epoch-day range.
 *
 * The year is stated once, on the end date. A block that crosses the new year —
 * `Dec 19 - Jan 8, 2026` — therefore starts in the previous year, which is what
 * the `startMonth > endMonth` test recovers.
 */
export function parseWeekHeader(raw: string): { start: EpochDay; end: EpochDay } | null {
  const m = raw.trim().match(/^([A-Za-z]{3,})\s+(\d{1,2})\s*-\s*([A-Za-z]{3,})\s+(\d{1,2}),?\s*(\d{4})$/);
  if (!m) return null;

  const [, mon1, d1, mon2, d2, yr] = m;
  const startMonth = MONTHS[mon1.slice(0, 3).toLowerCase()];
  const endMonth = MONTHS[mon2.slice(0, 3).toLowerCase()];
  if (!startMonth || !endMonth) return null;

  const endYear = Number(yr);
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    start: toEpochDay(`${startYear}-${pad(startMonth)}-${pad(Number(d1))}`),
    end: toEpochDay(`${endYear}-${pad(endMonth)}-${pad(Number(d2))}`),
  };
}

type Cell = string | number | boolean | null | undefined;

export async function loadWeeklyLeads(asOfDate: CivilDate): Promise<WeeklyLeads> {
  const spreadsheetId = process.env.CEO_MARKETING_SHEET_ID;
  if (!spreadsheetId) {
    return { leads: null, cpl: null, weekLabel: null, sections: 0, source: "none", warnings: [] };
  }

  const sheets = getSheetsClient();
  // A:BO covers all three sections' label + value columns (the furthest, BM/BN,
  // is column 65). Reading the whole height in one call.
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB}'!A1:BO2000`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const rows = (response.data.values as Cell[][] | undefined) ?? [];

  // Every block starts with a date header in column B.
  const headers: Array<{ row: number; label: string; start: EpochDay; end: EpochDay }> = [];
  rows.forEach((r, i) => {
    const label = String(r[1] ?? "").trim();
    const range = parseWeekHeader(label);
    if (range) headers.push({ row: i, label, ...range });
  });

  const targetFriday = weekStart(toEpochDay(asOfDate));
  // The block whose date range contains the target week's Friday. Most blocks
  // are a single week; a few (holiday merges) span several, hence the range test.
  const block = headers.find((h) => targetFriday >= h.start && targetFriday <= h.end);

  if (!block) {
    return {
      leads: null,
      cpl: null,
      weekLabel: null,
      sections: 0,
      source: "sheet",
      warnings: [`No week block covering ${fromEpochDay(targetFriday)} in "${TAB}"`],
    };
  }

  const nextRow = headers.find((h) => h.row > block.row)?.row ?? rows.length;
  const blockRows = rows.slice(block.row, nextRow);

  // Each section is anchored by its "Weekly Total Leads" cell. The lead total is
  // the cell to its right; the section CPL is the first "CPL" below it, in the
  // same column — the rows between are not always adjacent, so we scan rather
  // than assume a fixed offset.
  let leads = 0;
  let sections = 0;
  const cpls: number[] = [];

  blockRows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] !== "string" || !LEADS_LABEL.test(String(row[c]).trim())) continue;

      const leadValue = row[c + 1];
      if (typeof leadValue === "number" && Number.isFinite(leadValue)) {
        leads += leadValue;
        sections++;
      }

      // First "CPL" below this anchor, same column. A section whose leads are
      // zero has a #DIV/0! CPL (a string) — skipped, so it does not drag the
      // average toward zero.
      for (let rr = r + 1; rr < blockRows.length; rr++) {
        if (typeof blockRows[rr]?.[c] === "string" && CPL_LABEL.test(String(blockRows[rr][c]).trim())) {
          const cplValue = blockRows[rr][c + 1];
          if (typeof cplValue === "number" && Number.isFinite(cplValue)) cpls.push(cplValue);
          break;
        }
      }
    }
  });

  const warnings: string[] = [];
  if (sections === 0) {
    warnings.push(`No "Weekly Total Leads" cells in the ${block.label} block`);
  }

  return {
    leads: sections > 0 ? leads : null,
    cpl: cpls.length > 0 ? cpls.reduce((a, b) => a + b, 0) / cpls.length : null,
    weekLabel: block.label,
    sections,
    source: "sheet",
    warnings,
  };
}
