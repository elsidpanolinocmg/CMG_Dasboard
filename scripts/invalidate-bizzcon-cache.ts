import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import { getCache } from "../src/lib/cache";

async function main() {
  const removed = await getCache().invalidate("bizzcon:", { prefix: true });
  console.log(`Invalidated ${removed} entries under "bizzcon:"`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
