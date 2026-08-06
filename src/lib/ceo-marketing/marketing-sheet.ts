import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { getSheetsClient } from "@/lib/sources/googleOAuth";
import { fromEpochDay, toEpochDay, weekStart, type CivilDate, type EpochDay } from "@/lib/ceo/week";
import { CATEGORIES, type CategoryUnit } from "./categories";

/**
 * Reads the weekly campaign figures from the "Campaigns Report + Analysis"
 * workbook, tab "Weekly Overall Report".
 *
 * The tab is a stack of Friday–Thursday weekly blocks. Each block repeats four
 * side-by-side sections — Awards, Bizcon, Sales, Awards.info — and each section
 * carries its own totals in the column beside its labels. This reads them per
 * section rather than summing, so every category gets its own cards.
 *
 * All money is taken as SGD and shown as-is; the sheet already keeps it in the
 * reporting currency.
 */

const TAB = "Weekly Overall Report";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface CategoryTotals {
  key: string;
  label: string;
  unit: CategoryUnit;
  /** Leads, or clicks for Sales. */
  primary: number | null;
  /** Cost per lead, or cost per click for Sales. */
  cost: number | null;
  spend: number | null;
  /** Awards.info only. */
  qualityLeads: number | null;
  qualityCost: number | null;
  primaryTarget: number;
  costTarget: number;
  qualityTarget: number | null;
  qualityCostTarget: number | null;
}

export interface WeeklyMarketing {
  categories: CategoryTotals[];
  /** The block's own label, e.g. "Jun 26 - Jul 2, 2026". */
  weekLabel: string | null;
  /** The Thursday that closes the shown block, so the page can pace the header. */
  weekEnd: CivilDate | null;
  source: "sheet" | "none";
  warnings: string[];
}

/**
 * Parses a block header like `Jun 26 - Jul 2, 2026` into its epoch-day range.
 * The year is stated once, on the end date, so a block crossing the new year —
 * `Dec 19 - Jan 8, 2026` — starts in the previous one.
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

function num(v: Cell): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function loadWeeklyMarketing(
  asOfDate: CivilDate,
  opts: { latest?: boolean } = {},
): Promise<WeeklyMarketing> {
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_marketing",
    process.env.CEO_MARKETING_SHEET_ID,
  );
  const blank = (): CategoryTotals[] =>
    CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      primary: null,
      cost: null,
      spend: null,
      qualityLeads: null,
      qualityCost: null,
      primaryTarget: c.primaryTarget,
      costTarget: c.costTarget,
      qualityTarget: c.qualityTarget ?? null,
      qualityCostTarget: c.qualityCostTarget ?? null,
    }));

  if (!spreadsheetId) {
    return { categories: blank(), weekLabel: null, weekEnd: null, source: "none", warnings: [] };
  }

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    // Full columns, not a fixed A1:BO2000 window: the tab grows by one block each
    // week, so a hardcoded last row eventually cuts off the newest block (its
    // header lands near the cap and its data rows fall past it).
    range: `'${TAB}'!A:BO`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const rows = (response.data.values as Cell[][] | undefined) ?? [];

  // Every block opens with a date header in column B.
  const headers: Array<{ row: number; label: string; start: EpochDay; end: EpochDay }> = [];
  rows.forEach((r, i) => {
    const label = String(r[1] ?? "").trim();
    const range = parseWeekHeader(label);
    if (range) headers.push({ row: i, label, ...range });
  });

  type Header = { row: number; label: string; start: EpochDay; end: EpochDay };

  /** Pulls every category's totals out of one week block. */
  const parseBlock = (block: Header): { categories: CategoryTotals[]; warnings: string[] } => {
    const nextRow = headers.find((h) => h.row > block.row)?.row ?? rows.length;
    const blockRows = rows.slice(block.row, nextRow);
    const warnings: string[] = [];

    const categories = CATEGORIES.map((config): CategoryTotals => {
      const col = config.labelColumn;

      /** The value beside the first row in this section whose label matches. */
      const valueFor = (test: RegExp, after = -1): { value: number | null; row: number } => {
        for (let r = after + 1; r < blockRows.length; r++) {
          const cell = blockRows[r]?.[col];
          if (typeof cell === "string" && test.test(cell.trim())) {
            return { value: num(blockRows[r][col + 1]), row: r };
          }
        }
        return { value: null, row: -1 };
      };

      const primaryLabel = config.unit === "leads" ? /^weekly total leads$/i : /^weekly total clicks$/i;
      const primary = valueFor(primaryLabel);
      const spend = valueFor(/^weekly total spent$/i);

      // The weekly cost sits in the first "CPL" *below* the primary total — the
      // rows above it are per-platform rates for the same section.
      const cost =
        config.unit === "leads"
          ? valueFor(/^cpl$/i, primary.row).value
          : // Sales has no cost row; derive cost per click from spend and clicks.
            primary.value && spend.value !== null && primary.value > 0
            ? spend.value / primary.value
            : null;

      const quality = config.hasQualityLeads ? valueFor(/^weekly total quality leads$/i).value : null;
      const qualityCost = config.hasQualityLeads ? valueFor(/^cpl of quality leads$/i).value : null;

      if (primary.value === null) {
        warnings.push(`${config.label}: no "${config.unit}" total found in the ${block.label} block`);
      }

      return {
        key: config.key,
        label: config.label,
        unit: config.unit,
        primary: primary.value,
        cost,
        spend: spend.value,
        qualityLeads: quality,
        qualityCost,
        primaryTarget: config.primaryTarget,
        costTarget: config.costTarget,
        qualityTarget: config.qualityTarget ?? null,
        qualityCostTarget: config.qualityCostTarget ?? null,
      };
    });

    return { categories, warnings };
  };

  const hasData = (cats: CategoryTotals[]) => cats.some((c) => c.primary !== null);

  // Pick the block to show. Following the sheet, that's the most recent block that
  // has already started and actually carries figures — so a not-yet-filled current
  // week is skipped for the last one with data. Otherwise it's the block covering
  // the requested week.
  let block: Header | undefined;
  let parsed: { categories: CategoryTotals[]; warnings: string[] } | undefined;

  if (opts.latest) {
    const started = headers
      .filter((h) => h.start <= toEpochDay(asOfDate))
      .sort((a, b) => b.end - a.end);
    for (const h of started) {
      const p = parseBlock(h);
      if (hasData(p.categories)) {
        block = h;
        parsed = p;
        break;
      }
    }
    // Nothing populated yet — fall back to the latest started block, empty as it is.
    if (!block && started.length > 0) {
      block = started[0];
      parsed = parseBlock(block);
    }
  } else {
    const targetFriday = weekStart(toEpochDay(asOfDate));
    block = headers.find((h) => targetFriday >= h.start && targetFriday <= h.end);
    if (block) parsed = parseBlock(block);
  }

  if (!block || !parsed) {
    const missing = opts.latest
      ? `No week block with data in "${TAB}"`
      : `No week block covering ${fromEpochDay(weekStart(toEpochDay(asOfDate)))} in "${TAB}"`;
    return { categories: blank(), weekLabel: null, weekEnd: null, source: "sheet", warnings: [missing] };
  }

  return {
    categories: parsed.categories,
    weekLabel: block.label,
    weekEnd: fromEpochDay(block.end),
    source: "sheet",
    warnings: parsed.warnings,
  };
}
