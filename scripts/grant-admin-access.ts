/**
 * Grants admin-panel access (`isAdmin`).
 *
 *   tsx scripts/grant-admin-access.ts            # everyone who already has a password
 *   tsx scripts/grant-admin-access.ts <username> # one person
 *
 * The no-argument form is the migration for the release that introduced
 * `isAdmin`: before it, any account with a password could open the panel, so
 * granting exactly that set preserves access rather than locking everyone out.
 * Keep the script around — it is also the way back in if admin is ever revoked
 * from the last remaining admin.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const username = process.argv[2];
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    console.error("MONGODB_URI and MONGODB_DB must be set");
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const col = client.db(dbName).collection("people");
    const filter = username
      ? { username }
      : { "auth.passwordHash": { $exists: true }, active: true };

    const targets = await col
      .find(filter)
      .project({ _id: 0, username: 1, isAdmin: 1 })
      .toArray();

    if (targets.length === 0) {
      console.error("No matching people found — nothing granted.");
      process.exit(1);
    }

    const res = await col.updateMany(filter, {
      $set: { isAdmin: true, updatedAt: new Date() },
    });
    console.log(`Granted admin access to ${targets.length} account(s), ${res.modifiedCount} changed:`);
    for (const t of targets) {
      console.log(`  ${t.username}${t.isAdmin ? " (already had it)" : ""}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
