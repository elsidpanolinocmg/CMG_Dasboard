import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import { getDb } from "../src/lib/db";

const ASSIGNMENTS: { slug: string; secondaryColor: string }[] = [
  { slug: "ra", secondaryColor: "#F29A14" },
  { slug: "ap", secondaryColor: "#41AD49" },
];

async function main() {
  const db = await getDb();
  const col = db.collection("brands");
  for (const { slug, secondaryColor } of ASSIGNMENTS) {
    const res = await col.updateOne(
      { slug },
      { $set: { secondaryColor, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) {
      console.warn(`! brand "${slug}" not found — skipped`);
    } else {
      console.log(`✓ ${slug} → secondaryColor=${secondaryColor}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
