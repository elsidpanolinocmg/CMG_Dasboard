import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { applyIndexes, indexSpecs } from "../src/lib/repos/indexes";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    console.error("MONGODB_URI and MONGODB_DB must be set");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);

    // One-time cleanup: legacy person_departments join collection was replaced
    // by an embedded array on the people doc. Drop the empty orphan if present.
    const legacy = await db.listCollections({ name: "person_departments" }).toArray();
    if (legacy.length > 0) {
      await db.dropCollection("person_departments");
      console.log("Dropped legacy person_departments collection.");
    }

    console.log(`Applying ${indexSpecs.length} index specs to ${dbName}...`);
    await applyIndexes(db);
    console.log("Indexes applied.");

    const cols = await db.listCollections({}, { nameOnly: true }).toArray();
    console.log(`Collections in ${dbName}:`, cols.map((c) => c.name).sort().join(", ") || "(none)");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
