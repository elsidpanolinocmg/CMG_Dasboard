import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/sources/googleOAuth";

/**
 * A workbook's last-edit time from Drive (any tab), as ISO 8601 — a truer "as of"
 * than the moment we read it. Returns null when the token has no Drive scope or
 * the call fails, so callers can fall back to the read time.
 */
export async function readSheetModifiedTime(spreadsheetId: string): Promise<string | null> {
  try {
    const drive = google.drive({ version: "v3", auth: getOAuth2Client() });
    const res = await drive.files.get({ fileId: spreadsheetId, fields: "modifiedTime", supportsAllDrives: true });
    return res.data.modifiedTime ?? null;
  } catch {
    return null;
  }
}
