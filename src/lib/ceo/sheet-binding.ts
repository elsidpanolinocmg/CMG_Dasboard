import { resolveBinding } from "@/lib/sources/bindings";
import type { BindingPurpose } from "@/lib/entities";

/**
 * The CEO dashboards are not a department, so their bindings live under this
 * reserved scope slug in `data_source_bindings`.
 */
export const CEO_SCOPE = "ceo";

/**
 * Resolves the spreadsheet backing a CEO dashboard: an admin-panel binding
 * (scope `ceo`, kind `google_sheets`) wins, and the environment variable that
 * configured existing deployments remains the fallback. A database outage
 * falls back to the env var too — the dashboard must not go dark because the
 * settings store hiccuped.
 */
export async function resolveCeoSheetId(
  purpose: BindingPurpose,
  envValue: string | undefined,
): Promise<string | undefined> {
  try {
    const binding = await resolveBinding(CEO_SCOPE, purpose, "google_sheets");
    const id = (binding?.config as { spreadsheetId?: unknown } | undefined)
      ?.spreadsheetId;
    if (typeof id === "string" && id.trim()) return id.trim();
  } catch {
    // fall through to the env var
  }
  return envValue || undefined;
}
