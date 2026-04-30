import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import { findOne } from "../src/lib/repos/dataSourceBindings";
import { readSheet } from "../src/lib/sources/sheets";
import { normalizeKey } from "../src/lib/util/normalizeKey";
import { normalizePIC } from "../src/lib/util/normalizePIC";
import * as people from "../src/lib/repos/people";

interface Aggregate {
  display: string;
  key: string;
  deals: number;
  totalUsd: number;
  topAward: string;
  awardTotals: Record<string, number>;
  awardFirstSeen: Record<string, number>;
}

function parseCurrency(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const binding = await findOne("awards", "leaderboard", "google_sheets");
  if (!binding) {
    console.error("No awards/leaderboard/google_sheets binding configured.");
    process.exit(1);
  }
  const cfg = binding.config as { spreadsheetId?: string; sheetName?: string; range?: string };
  if (!cfg.spreadsheetId) {
    console.error("Binding missing spreadsheetId.");
    process.exit(1);
  }

  const sheet = await readSheet({
    spreadsheetId: cfg.spreadsheetId,
    sheetName: cfg.sheetName,
    range: cfg.range,
  });

  const byKey = new Map<string, Aggregate>();
  let awardSeq = 0;
  for (const row of sheet.rows) {
    const awardName = String(row[0] ?? "").trim();
    const display = normalizePIC(row[1]);
    const usd = parseCurrency(row[4]);
    if (!display || !awardName) continue;
    const key = normalizeKey(display);
    if (!key) continue;
    let agg = byKey.get(key);
    if (!agg) {
      agg = {
        display,
        key,
        deals: 0,
        totalUsd: 0,
        topAward: "",
        awardTotals: {},
        awardFirstSeen: {},
      };
      byKey.set(key, agg);
    }
    agg.deals += 1;
    if (usd != null && usd > 0) agg.totalUsd += usd;
    const score = usd ?? 0;
    agg.awardTotals[awardName] = (agg.awardTotals[awardName] ?? 0) + score;
    if (agg.awardFirstSeen[awardName] === undefined) {
      agg.awardFirstSeen[awardName] = awardSeq++;
    }
  }

  for (const agg of byKey.values()) {
    let top = "";
    let topVal = -Infinity;
    let topSeen = Infinity;
    for (const [name, val] of Object.entries(agg.awardTotals)) {
      const seen = agg.awardFirstSeen[name] ?? Infinity;
      if (val > topVal || (val === topVal && seen < topSeen)) {
        top = name;
        topVal = val;
        topSeen = seen;
      }
    }
    agg.topAward = top;
  }

  const all = await people.listAll();
  const ownerByKey = new Map<string, { username: string; displayName: string }>();
  for (const p of all) {
    for (const k of p.nameKeys ?? []) {
      if (!ownerByKey.has(k)) {
        ownerByKey.set(k, { username: p.username, displayName: p.displayName });
      }
    }
  }

  const rows = Array.from(byKey.values()).sort((a, b) => b.totalUsd - a.totalUsd);

  console.log(`# Awards PIC list (${rows.length} distinct names)`);
  console.log(`# Source: ${binding.config?.spreadsheetId ?? "?"}`);
  console.log("");
  console.log("idx | display name                    | key                      | deals | total       | mapped → | top award");
  console.log("-".repeat(140));
  rows.forEach((r, i) => {
    const owner = ownerByKey.get(r.key);
    const idx = String(i + 1).padStart(3, " ");
    const disp = r.display.padEnd(32, " ").slice(0, 32);
    const key = r.key.padEnd(24, " ").slice(0, 24);
    const deals = String(r.deals).padStart(5, " ");
    const total = `$${Math.round(r.totalUsd).toLocaleString("en-US")}`.padStart(11, " ");
    const mapped = owner ? owner.username : "—";
    const top = (r.topAward || "").slice(0, 50);
    console.log(`${idx} | ${disp} | ${key} | ${deals} | ${total} | ${mapped.padEnd(20, " ")} | ${top}`);
  });

  const unmapped = rows.filter((r) => !ownerByKey.has(r.key)).length;
  console.log("");
  console.log(`Mapped: ${rows.length - unmapped}    Unmapped: ${unmapped}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
