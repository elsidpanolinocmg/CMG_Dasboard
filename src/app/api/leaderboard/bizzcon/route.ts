import { NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { findOne } from "@/lib/repos/dataSourceBindings";
import { getSheetsClient } from "@/lib/sources/googleOAuth";
import * as peopleRepo from "@/lib/repos/people";
import { normalizeKey } from "@/lib/util/normalizeKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cell = number | string | null;

type Week = {
  week: string;
  values: Record<string, Cell>;
  weeklyTotal: number;
  monthlyTotal: number | null;
};

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

type Payload = {
  salespeople: string[];
  weeks: Week[];
  totals: Record<string, number>;
  grandTotal: number;
  currentQuarter: Quarter;
  quarterTotals: Record<string, number>;
  lastUpdated: string;
  rosterCount: number;
  unmatched: string[];
};

type Roster = {
  count: number;
  byKey: Map<string, { displayName: string }>;
};

async function loadRoster(): Promise<Roster> {
  const team = await peopleRepo.listByDepartment("bizzcon");
  const byKey = new Map<string, { displayName: string }>();
  for (const p of team) {
    for (const k of p.nameKeys ?? []) {
      if (!byKey.has(k)) byKey.set(k, { displayName: p.displayName });
    }
  }
  return { count: team.length, byKey };
}

function resolveCanonical(
  name: string,
  roster: Roster,
): { canonical: string; matched: boolean } {
  if (roster.count === 0) return { canonical: name, matched: true };
  const k = normalizeKey(name);
  const hit = roster.byKey.get(k);
  if (hit) return { canonical: hit.displayName, matched: true };
  return { canonical: name, matched: false };
}

const RANGE_SUFFIX = "!A1:J40";

function parseCurrency(raw: unknown): Cell {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const cleaned = s.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  return s.toUpperCase();
}

function currentQuarter(d = new Date()): Quarter {
  const m = d.getMonth();
  if (m <= 2) return "Q1";
  if (m <= 5) return "Q2";
  if (m <= 8) return "Q3";
  return "Q4";
}

const QUARTER_LABELS: Record<Quarter, RegExp> = {
  Q1: /^1st\s*quarter$/i,
  Q2: /^2nd\s*quarter$/i,
  Q3: /^3rd\s*quarter$/i,
  Q4: /^4th\s*quarter$/i,
};

async function resolveTabName(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  gid: number,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const found = meta.data.sheets?.find((s) => s.properties?.sheetId === gid);
  if (!found?.properties?.title) {
    throw new Error(`Sheet tab with gid=${gid} not found in ${spreadsheetId}`);
  }
  return found.properties.title;
}

const QUARTER_HEADER_RE = /^(q[1-4]|[1-4](st|nd|rd|th)\s*quarter)$/i;
function isQuarterLabel(s: string): boolean {
  return QUARTER_HEADER_RE.test(s.trim());
}

function quarterFromLabel(s: string): Quarter | null {
  const m = s.trim().match(/^q([1-4])$/i) ?? s.trim().match(/^([1-4])(?:st|nd|rd|th)/i);
  if (!m) return null;
  return `Q${m[1]}` as Quarter;
}

async function buildPayload(): Promise<Payload> {
  const binding = await findOne("bizzcon", "leaderboard", "google_sheets");
  if (!binding) throw new Error("No google_sheets binding for bizzcon/leaderboard");
  const cfg = binding.config as {
    spreadsheetId?: string;
    gid?: number;
    sheetName?: string;
  };
  if (!cfg.spreadsheetId) throw new Error("Bizzcon leaderboard binding missing spreadsheetId");

  const sheets = getSheetsClient();
  const tabName =
    cfg.sheetName ??
    (cfg.gid != null
      ? await resolveTabName(sheets, cfg.spreadsheetId, cfg.gid)
      : null);
  if (!tabName) throw new Error("Bizzcon leaderboard binding needs sheetName or gid");

  const range = `'${tabName.replace(/'/g, "''")}'${RANGE_SUFFIX}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: cfg.spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = res.data.values ?? [];
  if (rows.length === 0) throw new Error("Empty sheet");

  const header = rows[0].map((c) => String(c ?? "").trim());
  const totalIdx = header.findIndex((h) => h.toUpperCase() === "TOTAL");

  // Detect layout: if the columns between A and TOTAL are quarter labels
  // (Q1/Q2/Q3/Q4 or "1st Quarter" etc.), the sheet is people-as-rows.
  const headerEnd = totalIdx === -1 ? header.length : totalIdx;
  const middleHeaders = header.slice(1, headerEnd).filter((s) => s.length > 0);
  const isPeopleAsRows =
    middleHeaders.length > 0 && middleHeaders.every(isQuarterLabel);

  const roster = await loadRoster();

  if (isPeopleAsRows) {
    return parsePeopleAsRows(header, rows, totalIdx, roster);
  }

  const monthlyIdx = header.findIndex((h) => h.toUpperCase().includes("MONTHLY"));
  const salespeople = header
    .slice(1, totalIdx === -1 ? header.length : totalIdx)
    .filter((n) => n.length > 0);

  const totals: Record<string, number> = Object.fromEntries(salespeople.map((n) => [n, 0]));
  const quarterTotals: Record<string, number> = Object.fromEntries(
    salespeople.map((n) => [n, 0]),
  );
  const weeks: Week[] = [];

  const nowQuarter = currentQuarter();
  const quarterRegex = QUARTER_LABELS[nowQuarter];
  const isQuarterRow = (label: string) =>
    Object.values(QUARTER_LABELS).some((re) => re.test(label));

  let inWeeklySection = true;
  let totalsRowFound = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const label = String(row[0] ?? "").trim();

    if (label.toUpperCase() === "TOTAL") {
      salespeople.forEach((name, idx) => {
        const cell = parseCurrency(row[1 + idx]);
        if (typeof cell === "number") totals[name] = cell;
      });
      totalsRowFound = true;
      inWeeklySection = false;
      continue;
    }

    if (quarterRegex.test(label)) {
      salespeople.forEach((name, idx) => {
        const cell = parseCurrency(row[1 + idx]);
        if (typeof cell === "number") quarterTotals[name] += cell;
      });
      inWeeklySection = false;
      continue;
    }

    if (isQuarterRow(label)) {
      inWeeklySection = false;
      continue;
    }

    if (!inWeeklySection) continue;
    if (!label) continue;

    const values: Record<string, Cell> = {};
    salespeople.forEach((name, idx) => {
      const cell = parseCurrency(row[1 + idx]);
      values[name] = cell;
      if (!totalsRowFound && typeof cell === "number") totals[name] += cell;
    });

    const weeklyRaw = totalIdx >= 0 ? parseCurrency(row[totalIdx]) : null;
    const monthlyRaw = monthlyIdx >= 0 ? parseCurrency(row[monthlyIdx]) : null;

    weeks.push({
      week: label,
      values,
      weeklyTotal: typeof weeklyRaw === "number" ? weeklyRaw : 0,
      monthlyTotal: typeof monthlyRaw === "number" ? monthlyRaw : null,
    });
  }

  // Filter to roster: drop sheet columns whose name doesn't match a bizzcon
  // person (via nameKeys). Falls back to the raw sheet names if the roster is
  // empty so an unconfigured deployment still shows something.
  const unmatched: string[] = [];
  const filteredSalespeople: string[] = [];
  const nameMap = new Map<string, string>(); // raw sheet name → canonical
  for (const raw of salespeople) {
    const r = resolveCanonical(raw, roster);
    if (!r.matched) {
      unmatched.push(raw);
      continue;
    }
    filteredSalespeople.push(r.canonical);
    nameMap.set(raw, r.canonical);
  }
  const fTotals: Record<string, number> = {};
  const fQuarterTotals: Record<string, number> = {};
  for (const c of filteredSalespeople) {
    fTotals[c] = 0;
    fQuarterTotals[c] = 0;
  }
  for (const [raw, canonical] of nameMap) {
    fTotals[canonical] += totals[raw] ?? 0;
    fQuarterTotals[canonical] += quarterTotals[raw] ?? 0;
  }
  const filteredWeeks = weeks.map((w) => {
    const fv: Record<string, Cell> = {};
    for (const [raw, canonical] of nameMap) {
      fv[canonical] = w.values[raw] ?? null;
    }
    return { ...w, values: fv };
  });

  const grandTotal = Object.values(fTotals).reduce((a, b) => a + b, 0);

  return {
    salespeople: filteredSalespeople,
    weeks: filteredWeeks,
    totals: fTotals,
    grandTotal,
    currentQuarter: nowQuarter,
    quarterTotals: fQuarterTotals,
    lastUpdated: new Date().toISOString(),
    rosterCount: roster.count,
    unmatched,
  };
}

function parsePeopleAsRows(
  header: string[],
  rows: (string | number | null)[][],
  totalIdx: number,
  roster: Roster,
): Payload {
  // Map each quarter column index → which Quarter it is.
  const headerEnd = totalIdx === -1 ? header.length : totalIdx;
  const quarterCols: { col: number; quarter: Quarter }[] = [];
  for (let i = 1; i < headerEnd; i++) {
    const q = quarterFromLabel(header[i] ?? "");
    if (q) quarterCols.push({ col: i, quarter: q });
  }

  const salespeople: string[] = [];
  const totals: Record<string, number> = {};
  const quarterTotals: Record<string, number> = {};
  const unmatched: string[] = [];
  const nowQuarter = currentQuarter();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawName = String(row[0] ?? "").trim();
    if (!rawName) continue;
    if (rawName.toUpperCase() === "TOTAL") continue;

    const r = resolveCanonical(rawName, roster);
    if (!r.matched) {
      unmatched.push(rawName);
      continue;
    }
    const name = r.canonical;

    let rowSum = 0;
    let currentQ = 0;
    for (const { col, quarter } of quarterCols) {
      const cell = parseCurrency(row[col]);
      if (typeof cell === "number") {
        rowSum += cell;
        if (quarter === nowQuarter) currentQ += cell;
      }
    }

    let total = rowSum;
    if (totalIdx >= 0) {
      const t = parseCurrency(row[totalIdx]);
      if (typeof t === "number") total = t;
    }

    if (!salespeople.includes(name)) salespeople.push(name);
    totals[name] = (totals[name] ?? 0) + total;
    quarterTotals[name] = (quarterTotals[name] ?? 0) + currentQ;
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return {
    salespeople,
    weeks: [],
    totals,
    grandTotal,
    currentQuarter: nowQuarter,
    quarterTotals,
    lastUpdated: new Date().toISOString(),
    rosterCount: roster.count,
    unmatched,
  };
}

export async function GET(req: Request) {
  try {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const cache = getCache();
    const key = cacheKeys.bizzconLeaderboard();
    if (fresh) await cache.invalidate(key);
    const payload = await cache.getOrLoad<Payload>(
      key,
      buildPayload,
      { ttlMs: ttls.LEADERBOARD, staleMs: ttls.LEADERBOARD_STALE },
    );
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("API /api/leaderboard/bizzcon failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
