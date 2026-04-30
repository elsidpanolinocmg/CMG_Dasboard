import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import { findOne } from "../src/lib/repos/dataSourceBindings";
import { getSheetsClient } from "../src/lib/sources/googleOAuth";

async function main() {
  const binding = await findOne("bizzcon", "leaderboard", "google_sheets");
  if (!binding) throw new Error("No binding");
  const cfg = binding.config as {
    spreadsheetId?: string;
    gid?: number;
    sheetName?: string;
  };
  console.log("config:", cfg);
  if (!cfg.spreadsheetId) throw new Error("Missing spreadsheetId");

  const sheets = getSheetsClient();
  let tabName = cfg.sheetName;
  if (!tabName && cfg.gid != null) {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: cfg.spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    tabName = meta.data.sheets?.find(
      (s) => s.properties?.sheetId === cfg.gid,
    )?.properties?.title ?? undefined;
  }
  console.log("tabName:", tabName);
  const range = `'${tabName!.replace(/'/g, "''")}'!A1:J40`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: cfg.spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = res.data.values ?? [];
  console.log(`\n${rows.length} rows:\n`);
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    console.log(i, JSON.stringify(rows[i]));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
