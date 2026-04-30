import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import * as people from "../src/lib/repos/people";

interface AwardsPerson {
  username: string;
  displayName: string;
  // Synonyms — already-normalized keys from the awards leaderboard sheet.
  // Each synonym must be unique to one person. The username and displayName
  // are added on top automatically.
  synonyms: string[];
  // Awards-specific aggregate from the leaderboard sheet, stored as
  // per-department properties so the people record stays generic.
  awardsProperties: Record<string, string>;
}

const ROSTER: AwardsPerson[] = [
  {
    username: "maureen",
    displayName: "Maureen",
    synonyms: ["mauren", "mau"],
    awardsProperties: {
      deals: "43",
      totalUsd: "428755",
      topAward: "ABF",
      sourceDisplays: "Mauren, Mau",
    },
  },
  {
    username: "hanna.grace",
    displayName: "Hanna Grace",
    synonyms: ["hannagrace", "hanna", "grace"],
    awardsProperties: {
      deals: "40",
      totalUsd: "398325",
      topAward: "APA/AOGA/AWA",
      sourceDisplays: "Hanna Grace, Hanna, Grace",
    },
  },
];

function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

async function main() {
  for (const entry of ROSTER) {
    const baseKeys = Array.from(
      new Set(
        [normalizeKey(entry.username), normalizeKey(entry.displayName), ...entry.synonyms]
          .filter(Boolean),
      ),
    );

    // Refuse to clobber a synonym that's already on a different person.
    const conflicts: { key: string; owner: string }[] = [];
    for (const k of baseKeys) {
      const owner = await people.findByNameKey(k);
      if (owner && owner.username !== entry.username) {
        conflicts.push({ key: k, owner: owner.username });
      }
    }
    if (conflicts.length > 0) {
      console.error(
        `[${entry.username}] synonym conflicts: ${conflicts
          .map((c) => `"${c.key}" owned by ${c.owner}`)
          .join(", ")}`,
      );
      console.error("Skipping this entry.");
      continue;
    }

    await people.upsert({
      username: entry.username,
      displayName: entry.displayName,
      active: true,
      nameKeys: baseKeys,
      departments: [
        {
          departmentSlug: "awards",
          role: "viewer",
          since: new Date(),
          properties: entry.awardsProperties,
        },
      ],
    });

    console.log(
      `✓ ${entry.username} (${entry.displayName}) — synonyms: [${baseKeys.join(", ")}]; awards.props: ${JSON.stringify(entry.awardsProperties)}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
