import { NextRequest, NextResponse } from "next/server";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import { findOne } from "@/lib/repos/dataSourceBindings";
import { readSheet } from "@/lib/sources/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Entry {
  name: string;
  total: number;
  deals: number;
  topAward: string;
}

interface Payload {
  entries: Entry[];
  grandTotal: number;
  lastUpdated: string;
}

function parseCurrency(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizePIC(raw: unknown): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  const co = s.match(/\bc\/o\s+(.+)$/i);
  if (co) s = co[1].trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const sepIdx = s.search(/\s*[-,/]/);
  if (sepIdx > 0) s = s.slice(0, sepIdx).trim();
  s = s.replace(/\s+(website\s+lead|web\s+lead|li\s+leads?|campaign\s+lead|past\s+winner)$/i, "").trim();
  s = s.replace(/\s+(LI|Li|PW|Leads?|Campaign|Website|Incoming|50%)$/i, "").trim();
  return s;
}

interface Agg {
  displayName: string;
  total: number;
  deals: number;
  awardTotals: Record<string, number>;
  awardFirstSeen: Record<string, number>;
}

async function buildLeaderboard(dept: string): Promise<Payload> {
  const binding = await findOne(dept, "leaderboard", "google_sheets");
  if (!binding) {
    return { entries: [], grandTotal: 0, lastUpdated: new Date().toISOString() };
  }
  const cfg = binding.config as {
    spreadsheetId?: string;
    sheetName?: string;
    range?: string;
  };
  if (!cfg.spreadsheetId) {
    return { entries: [], grandTotal: 0, lastUpdated: new Date().toISOString() };
  }
  const sheet = await readSheet({
    spreadsheetId: cfg.spreadsheetId,
    sheetName: cfg.sheetName,
    range: cfg.range,
  });

  const byPIC: Record<string, Agg> = {};
  let awardSeq = 0;
  // First row is headers in readSheet, so sheet.rows starts at row index 1.
  for (const row of sheet.rows) {
    const awardName = String(row[0] ?? "").trim();
    const picRaw = row[1];
    const usd = parseCurrency(row[4]);
    const display = normalizePIC(picRaw);
    if (!display || !awardName || usd == null || usd <= 0) continue;
    const key = display.toLowerCase();
    let agg = byPIC[key];
    if (!agg) {
      agg = {
        displayName: display,
        total: 0,
        deals: 0,
        awardTotals: {},
        awardFirstSeen: {},
      };
      byPIC[key] = agg;
    }
    agg.total += usd;
    agg.deals += 1;
    agg.awardTotals[awardName] = (agg.awardTotals[awardName] ?? 0) + usd;
    if (agg.awardFirstSeen[awardName] === undefined) {
      agg.awardFirstSeen[awardName] = awardSeq++;
    }
  }

  const entries: Entry[] = Object.values(byPIC)
    .map((agg) => {
      let topAward = "";
      let topValue = -Infinity;
      let topSeen = Infinity;
      for (const [award, value] of Object.entries(agg.awardTotals)) {
        const seen = agg.awardFirstSeen[award] ?? Infinity;
        if (value > topValue || (value === topValue && seen < topSeen)) {
          topAward = award;
          topValue = value;
          topSeen = seen;
        }
      }
      return {
        name: agg.displayName,
        total: agg.total,
        deals: agg.deals,
        topAward,
      };
    })
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);

  const grandTotal = entries.reduce((sum, e) => sum + e.total, 0);
  return { entries, grandTotal, lastUpdated: new Date().toISOString() };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ department: string }> },
) {
  const { department: rawDept } = await params;
  const dept = decodeURIComponent(rawDept).toLowerCase();
  const allowed = new Set(["awards", "bizzcon", "editorial"]);
  if (!allowed.has(dept)) {
    return NextResponse.json({ error: "Unknown department" }, { status: 400 });
  }
  try {
    const key =
      dept === "awards"
        ? cacheKeys.awardsLeaderboard()
        : dept === "bizzcon"
          ? cacheKeys.bizzconLeaderboard()
          : `leaderboard:${dept}`;
    const payload = await getCache().getOrLoad<Payload>(
      key,
      () => buildLeaderboard(dept),
      { ttlMs: ttls.LEADERBOARD, staleMs: ttls.LEADERBOARD_STALE },
    );
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
