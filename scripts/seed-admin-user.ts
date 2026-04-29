import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

interface PersonShape {
  username: string;
  displayName: string;
  email?: string;
  active: boolean;
  nameKeys: string[];
  departments: { departmentSlug: string; role: string; since: Date }[];
  auth?: { passwordHash: string };
  createdAt: Date;
  updatedAt: Date;
}

function normalizeKey(raw: string): string {
  if (!raw) return "";
  const lower = raw.trim().toLowerCase();
  const local = lower.includes("@") ? lower.split("@")[0] : lower;
  return local.replace(/[\s._-]+/g, "");
}

async function main() {
  const [username, password, displayName] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: tsx scripts/seed-admin-user.ts <username> <password> [displayName]");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    console.error("MONGODB_URI and MONGODB_DB must be set");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const display = displayName ?? username;
  const nameKeys = Array.from(
    new Set([normalizeKey(username), normalizeKey(display)].filter(Boolean)),
  );

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const col = client.db(dbName).collection<PersonShape>("people");
    await col.updateOne(
      { username },
      {
        $set: {
          username,
          displayName: display,
          active: true,
          nameKeys,
          "auth.passwordHash": passwordHash,
          updatedAt: now,
        },
        $setOnInsert: {
          departments: [],
          createdAt: now,
        },
      },
      { upsert: true },
    );
    console.log(`Seeded admin user: ${username}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
