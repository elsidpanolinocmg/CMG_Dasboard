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

function buildA1(opts: SheetReadOptions): string {
  if (opts.range) {
    if (opts.range.startsWith("!")) {
      return `${opts.sheetName ? `'${opts.sheetName}'` : ""}${opts.range}`;
    }
    return opts.range;
  }
  if (opts.sheetName) return `'${opts.sheetName}'!A1:Z2000`;
  return "A1:Z2000";
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
