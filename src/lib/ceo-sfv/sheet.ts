import { resolveCeoSheetId } from "@/lib/ceo/sheet-binding";
import { getSheetsClient } from "@/lib/sources/googleOAuth";

/**
 * Reads the "Short Form Videos" workbook, tab "2026 summary": a small status
 * breakdown — one row per status with its video count in the next column — plus a
 * TOTAL VIDEOS figure and a LAST UPDATED timestamp in a side "SUMMARY" block.
 */

const TAB = "2026 summary";

export interface StatusCount {
  status: string;
  count: number;
}

export interface ShortFormVideos {
  /** Status → video count, sorted count-desc. */
  statuses: StatusCount[];
  /** TOTAL VIDEOS from the sheet (falls back to the sum of the statuses). */
  total: number;
  /** LAST UPDATED, formatted, or null if absent. */
  lastUpdated: string | null;
  source: "sheet" | "none";
  warnings: string[];
}

type Cell = string | number | boolean | null | undefined;

/** A Google Sheets serial (days since 1899-12-30) rendered at its face value. */
function serialToDisplay(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const d = new Date(Math.round((serial - 25569) * 86_400_000));
  return d.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function loadShortFormVideos(): Promise<ShortFormVideos> {
  // An admin-panel binding (purpose "ceo_short_form_videos") wins; the env var is
  // the fallback for deployments configured before the binding existed.
  const spreadsheetId = await resolveCeoSheetId(
    "ceo_short_form_videos",
    process.env.CEO_SHORT_FORM_VIDEOS_SHEET_ID,
  );
  if (!spreadsheetId) {
    return { statuses: [], total: 0, lastUpdated: null, source: "none", warnings: [] };
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB}'!A1:E40`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const rows = (res.data.values as Cell[][] | undefined) ?? [];

  const statuses: StatusCount[] = [];
  let total = 0;
  let lastUpdated: string | null = null;

  for (const r of rows) {
    // Status breakdown lives in columns A (label) / B (count).
    const label = String(r[0] ?? "").trim();
    const count = r[1];
    if (label && label.toUpperCase() !== "STATUS" && typeof count === "number" && Number.isFinite(count)) {
      statuses.push({ status: label, count });
    }
    // The side "SUMMARY" block lives in columns D (label) / E (value).
    const summaryLabel = String(r[3] ?? "").trim().toUpperCase();
    if (summaryLabel === "TOTAL VIDEOS" && typeof r[4] === "number") total = r[4];
    // LAST UPDATED is written by the sheet's Apps Script as a formatted string;
    // Sheets usually auto-converts it to a date serial, but not always — so accept
    // either a serial (render it) or a plain string (show as-is).
    if (summaryLabel === "LAST UPDATED") {
      const v = r[4];
      if (typeof v === "number") lastUpdated = serialToDisplay(v);
      else if (typeof v === "string" && v.trim()) lastUpdated = v.trim();
    }
  }

  statuses.sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  if (!total) total = statuses.reduce((sum, s) => sum + s.count, 0);

  return { statuses, total, lastUpdated, source: "sheet", warnings: [] };
}
