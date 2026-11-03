import { getSheetsClient } from "./googleOAuth";

export interface SheetReadOptions {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  gid?: number;
}

export interface SheetRows {
  spreadsheetId: string;
  range: string;
  rows: string[][];
  headers: string[];
}

/**
 * Combines a tab and a range into what the Sheets API expects. A range with no
 * tab of its own reads from `sheetName`; without this, Google falls back to the
 * spreadsheet's first tab and returns the wrong data with no error. A range that
 * names its own tab ('Sales'!A1:E500) is used exactly as written.
 */
export function buildA1(opts: Pick<SheetReadOptions, "sheetName" | "range">): string {
  const tab = opts.sheetName ? `'${opts.sheetName.replace(/'/g, "''")}'` : "";
  const range = opts.range?.trim() || "A1:Z2000";
  if (range.includes("!") && !range.startsWith("!")) return range;
  const cells = range.replace(/^!/, "");
  return tab ? `${tab}!${cells}` : cells;
}

export async function readSheet(opts: SheetReadOptions): Promise<SheetRows> {
  const sheets = getSheetsClient();
  const range = buildA1(opts);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: opts.spreadsheetId,
    range,
  });
  const values = (res.data.values as string[][] | undefined) ?? [];
  const headers = values[0] ?? [];
  return {
    spreadsheetId: opts.spreadsheetId,
    range: res.data.range ?? range,
    rows: values.slice(1),
    headers,
  };
}

export async function listTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter(Boolean);
}
