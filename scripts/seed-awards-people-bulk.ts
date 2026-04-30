import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import { findOne } from "../src/lib/repos/dataSourceBindings";
import { readSheet } from "../src/lib/sources/sheets";
import { normalizeKey } from "../src/lib/util/normalizeKey";
import { normalizePIC } from "../src/lib/util/normalizePIC";
import * as people from "../src/lib/repos/people";

// Normalized keys to NOT auto-create (still ambiguous — user will resolve later).
const AMBIGUOUS_KEYS = new Set([
  "irma", "imma",
  "julia", "julie",
  "ria", "rini",
  "abigail", "abby", "abi",
]);

// Normalized keys that aren't real people (award acronyms etc.).
const SKIP_KEYS = new Set(["atea"]);

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

function suggestUsername(display: string): string {
  return display
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

async function main() {
  const binding = await findOne("awards", "leaderboard", "google_sheets");
  if (!binding) throw new Error("No awards/leaderboard binding");
  const cfg = binding.config as { spreadsheetId?: string; sheetName?: string; range?: string };
  if (!cfg.spreadsheetId) throw new Error("Binding missing spreadsheetId");

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
        display, key,
        deals: 0, totalUsd: 0, topAward: "",
        awardTotals: {}, awardFirstSeen: {},
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
    let top = "", topVal = -Infinity, topSeen = Infinity;
    for (const [name, val] of Object.entries(agg.awardTotals)) {
      const seen = agg.awardFirstSeen[name] ?? Infinity;
      if (val > topVal || (val === topVal && seen < topSeen)) {
        top = name; topVal = val; topSeen = seen;
      }
    }
    agg.topAward = top;
  }

  let created = 0;
  let skippedAlreadyOwned = 0;
  let skippedAmbiguous = 0;
  let skippedNonPerson = 0;
  let skippedConflict = 0;

  for (const agg of byKey.values()) {
    if (SKIP_KEYS.has(agg.key)) {
      console.log(`· skip non-person: ${agg.display} (${agg.key})`);
      skippedNonPerson++;
      continue;
    }
    if (AMBIGUOUS_KEYS.has(agg.key)) {
      console.log(`· skip ambiguous: ${agg.display} (${agg.key}) — needs manual resolution`);
      skippedAmbiguous++;
      continue;
    }
    const owner = await people.findByNameKey(agg.key);
    if (owner) {
      console.log(`· already mapped: ${agg.display} (${agg.key}) → ${owner.username}`);
      skippedAlreadyOwned++;
      continue;
    }

    const username = suggestUsername(agg.display);
    if (!username) {
      console.error(`! cannot derive username for "${agg.display}"`);
      skippedConflict++;
      continue;
    }
    const existing = await people.findByUsername(username);
    if (existing) {
      console.error(`! username "${username}" already exists (display "${agg.display}")`);
      skippedConflict++;
      continue;
    }
    const baseKeys = Array.from(
      new Set([normalizeKey(username), normalizeKey(agg.display), agg.key].filter(Boolean)),
    );
    // One last collision check across all keys, in case some derived key (e.g. from a
    // multi-word display) is held by another person.
    const conflicts: string[] = [];
    for (const k of baseKeys) {
      const c = await people.findByNameKey(k);
      if (c && c.username !== username) conflicts.push(`"${k}" → ${c.username}`);
    }
    if (conflicts.length > 0) {
      console.error(`! synonym conflicts for ${username}: ${conflicts.join(", ")}`);
      skippedConflict++;
      continue;
    }

    const properties: Record<string, string> = {
      deals: String(agg.deals),
      totalUsd: String(Math.round(agg.totalUsd)),
      topAward: agg.topAward,
      sourceDisplays: agg.display,
    };

    await people.upsert({
      username,
      displayName: agg.display,
      active: true,
      nameKeys: baseKeys,
      departments: [
        {
          departmentSlug: "awards",
          role: "viewer",
          since: new Date(),
          properties,
        },
      ],
    });

    console.log(`✓ ${username} (${agg.display}) — keys: [${baseKeys.join(", ")}]; deals=${agg.deals}, total=$${properties.totalUsd}, top=${agg.topAward}`);
    created++;
  }

  console.log("");
  console.log(`Created: ${created}`);
  console.log(`Already mapped: ${skippedAlreadyOwned}`);
  console.log(`Skipped (ambiguous): ${skippedAmbiguous}`);
  console.log(`Skipped (non-person): ${skippedNonPerson}`);
  console.log(`Skipped (conflict): ${skippedConflict}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
