import { google } from "googleapis";
import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { today, toEpochDay, type EpochDay } from "@/lib/ceo/week";
import { getOAuth2Client, getSheetsClient } from "@/lib/sources/googleOAuth";

/**
 * Reads the magazine-materials workbook: one tab per magazine brand, each on the
 * same template. Every material (a company's ad/advertorial in an issue) is a row
 * from row 3 down — the issue year in column C, the status in column J, the
 * deadline in column M, the company in column G.
 *
 * Only 2026 materials are tracked (column C === "2026"). A material is DONE once it
 * is on the page or signed off ("On page", "Approved", "Proceed by default"); every
 * other live status is outstanding. "Cancelled", "Moved to later issue" and
 * "Archived" drop out of the totals entirely.
 *
 * A brand is OVERDUE when it has any outstanding material whose deadline has passed;
 * otherwise it is ON TRACK. Cards are grouped by brand.
 */

const MATERIALS_FROM_ROW = 3;
const YEAR = "2026";

/** Tabs that are not a single magazine brand. */
const NON_BRAND = new Set(["All magazine traffic", "Mastersheet (OLD)", "MASTERSHEET", "Guidelines"]);

/** Statuses that mean the material is finished. */
const DONE_STATUSES = new Set(["on page", "approved", "proceed by default"]);
/** Statuses that drop out of the totals altogether. */
const DROP_STATUSES = new Set(["cancelled", "moved to later issue", "archived"]);

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

type Cell = string | number | boolean | null | undefined;

export interface StatusSlice {
  status: string;
  count: number;
}

export interface MagazineBrand {
  /** The brand (worksheet tab) name, e.g. "SBR". */
  brand: string;
  /** Live 2026 materials (dropped statuses excluded). */
  total: number;
  /** Of those, how many are done (On page / Approved / Proceed by default). */
  done: number;
  /** Not yet done. */
  outstanding: number;
  /** Outstanding materials whose deadline has passed. */
  overdueCount: number;
  /** Status breakdown for the stacked bar — done first, then by count. */
  statuses: StatusSlice[];
  /** Timing vs deadlines: worst overdue when behind, else soonest upcoming. */
  dueLabel: string;
  /** True for an on-track brand whose soonest deadline is within a week. */
  dueSoon: boolean;
}

export interface MagazineMaterials {
  /** Brands with outstanding past-deadline materials, most overdue first. */
  overdue: MagazineBrand[];
  /** Brands on track (no overdue materials), by most outstanding first. */
  onTrack: MagazineBrand[];
  totalMaterials: number;
  totalDone: number;
  /** Outstanding materials whose deadline has passed, across all brands. */
  totalOverdue: number;
  totalBrands: number;
  /** Every status seen, done first — for a shared legend. */
  statusLegend: string[];
  /** Sheet's Drive last-edit time, or the read time; ISO 8601, or null. */
  updatedAt: string | null;
  source: "sheet" | "none";
  warnings: string[];
}

const EMPTY: MagazineMaterials = {
  overdue: [],
  onTrack: [],
  totalMaterials: 0,
  totalDone: 0,
  totalOverdue: 0,
  totalBrands: 0,
  statusLegend: [],
  updatedAt: null,
  source: "none",
  warnings: [],
};

/** Done statuses lead; the rest fall by count (descending). */
function byDoneThenCount(a: StatusSlice, b: StatusSlice): number {
  const ad = DONE_STATUSES.has(a.status.toLowerCase());
  const bd = DONE_STATUSES.has(b.status.toLowerCase());
  if (ad !== bd) return ad ? -1 : 1;
  return b.count - a.count || a.status.localeCompare(b.status);
}

/** How far a deadline is from today, in words: "5 months overdue", "due in 6 days". */
function humanizeDue(deadlineDay: EpochDay | null, todayDay: EpochDay): string {
  if (deadlineDay === null) return "";
  const diff = todayDay - deadlineDay; // positive = overdue
  if (diff === 0) return "due today";
  const mag = Math.abs(diff);
  const span =
    mag < 14
      ? `${mag} day${mag === 1 ? "" : "s"}`
      : mag < 60
        ? `${Math.round(mag / 7)} weeks`
        : `${Math.round(mag / 30)} months`;
  return diff > 0 ? `${span} overdue` : `due in ${span}`;
}

/** A free-text deadline ("9 February", "Jan 24", "24 April") → epoch day in 2026. */
function parseDeadline(raw: Cell): EpochDay | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let day: number | undefined;
  let monToken: string | undefined;
  let m = /^(\d{1,2})\s+([A-Za-z]+)/.exec(s); // "9 February"
  if (m) {
    day = Number(m[1]);
    monToken = m[2];
  } else {
    m = /^([A-Za-z]+)\s+(\d{1,2})/.exec(s); // "Jan 24"
    if (m) {
      monToken = m[1];
      day = Number(m[2]);
    }
  }
  if (day === undefined || !monToken) return null;
  const month = MONTHS[monToken.toLowerCase().slice(0, 3)];
  if (!month || day < 1 || day > 31) return null;
  const iso = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return toEpochDay(iso);
}

/** The sheet's last-edit time from Drive (best-effort); null when unavailable. */
async function readSheetModifiedTime(spreadsheetId: string): Promise<string | null> {
  try {
    const drive = google.drive({ version: "v3", auth: getOAuth2Client() });
    const res = await drive.files.get({ fileId: spreadsheetId, fields: "modifiedTime", supportsAllDrives: true });
    return res.data.modifiedTime ?? null;
  } catch {
    return null;
  }
}

export async function loadMagazineMaterials(): Promise<MagazineMaterials> {
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_magazine_materials",
    process.env.CEO_MAGAZINE_MATERIALS_SHEET_ID,
  );
  if (!spreadsheetId) return EMPTY;

  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const tabs = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((t) => t && !NON_BRAND.has(t));

  if (tabs.length === 0) return { ...EMPTY, source: "sheet" };

  // Columns C (year), G (company), J (status), M (deadline) beneath the header.
  const ranges = tabs.map((t) => `'${t}'!A${MATERIALS_FROM_ROW}:M6000`);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const valueRanges = res.data.valueRanges ?? [];

  const todayDay = toEpochDay(today());
  const overdue: MagazineBrand[] = [];
  const onTrack: MagazineBrand[] = [];
  let totalMaterials = 0;
  let totalDone = 0;
  let totalOverdue = 0;
  let totalBrands = 0;
  const legend = new Map<string, { display: string; count: number }>();

  tabs.forEach((brand, i) => {
    const rows = (valueRanges[i]?.values ?? []) as Cell[][];

    let total = 0;
    let done = 0;
    let overdueCount = 0;
    let worstOverdue: EpochDay | null = null; // smallest (oldest) past deadline
    let soonestUpcoming: EpochDay | null = null; // smallest future deadline
    const perStatus = new Map<string, { display: string; count: number }>();

    for (const row of rows) {
      const year = String(row[2] ?? "").trim(); // C
      const company = String(row[6] ?? "").trim(); // G
      const rawStatus = String(row[9] ?? "").trim(); // J
      const key = rawStatus.toLowerCase();
      // A real material is a 2026 row that names a company and isn't dropped.
      if (year !== YEAR || !company || DROP_STATUSES.has(key)) continue;

      total++;
      const display = rawStatus || "No status";
      const legendKey = rawStatus ? key : "no status";
      const isDone = DONE_STATUSES.has(key);
      if (isDone) done++;

      const bump = (m: Map<string, { display: string; count: number }>, k: string) => {
        const e = m.get(k);
        if (e) e.count++;
        else m.set(k, { display, count: 1 });
      };
      bump(perStatus, legendKey);
      bump(legend, legendKey);

      const deadlineDay = parseDeadline(row[12]); // M
      if (!isDone && deadlineDay !== null) {
        if (deadlineDay < todayDay) {
          overdueCount++;
          if (worstOverdue === null || deadlineDay < worstOverdue) worstOverdue = deadlineDay;
        } else if (soonestUpcoming === null || deadlineDay < soonestUpcoming) {
          soonestUpcoming = deadlineDay;
        }
      }
    }

    if (total === 0) return; // no 2026 materials on this brand

    const outstanding = total - done;
    const statuses: StatusSlice[] = [...perStatus.values()]
      .map((e) => ({ status: e.display, count: e.count }))
      .sort(byDoneThenCount);
    const isOverdue = overdueCount > 0;
    const dueLabel = isOverdue
      ? humanizeDue(worstOverdue, todayDay)
      : soonestUpcoming !== null
        ? humanizeDue(soonestUpcoming, todayDay)
        : outstanding > 0
          ? "no deadline set"
          : "all done";
    const dueSoon = !isOverdue && soonestUpcoming !== null && soonestUpcoming - todayDay <= 7;

    const entry: MagazineBrand = { brand, total, done, outstanding, overdueCount, statuses, dueLabel, dueSoon };

    totalMaterials += total;
    totalDone += done;
    totalOverdue += overdueCount;
    totalBrands++;
    if (isOverdue) overdue.push(entry);
    else onTrack.push(entry);
  });

  overdue.sort((a, b) => b.overdueCount - a.overdueCount || b.outstanding - a.outstanding || a.brand.localeCompare(b.brand));
  onTrack.sort((a, b) => b.outstanding - a.outstanding || a.brand.localeCompare(b.brand));

  const statusLegend = [...legend.values()]
    .map((e) => ({ status: e.display, count: e.count }))
    .sort(byDoneThenCount)
    .map((s) => s.status);

  const updatedAt = (await readSheetModifiedTime(spreadsheetId)) ?? new Date().toISOString();

  return {
    overdue,
    onTrack,
    totalMaterials,
    totalDone,
    totalOverdue,
    totalBrands,
    statusLegend,
    updatedAt,
    source: "sheet",
    warnings: [],
  };
}
