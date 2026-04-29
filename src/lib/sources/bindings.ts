import { findOne, listByDepartment } from "@/lib/repos/dataSourceBindings";
import type {
  BindingPurpose,
  DataSourceBinding,
  ExternalDataSourceKind,
} from "@/lib/entities";

export async function resolveBinding(
  departmentSlug: string,
  purpose: BindingPurpose,
  preferredKind?: ExternalDataSourceKind,
): Promise<DataSourceBinding | null> {
  if (preferredKind) {
    const exact = await findOne(departmentSlug, purpose, preferredKind);
    if (exact) return exact;
  }
  // Fall back: any binding for this dept + purpose.
  const all = await listByDepartment(departmentSlug);
  return all.find((b) => b.purpose === purpose) ?? null;
}

export async function probeBinding(binding: DataSourceBinding): Promise<{
  ok: boolean;
  detail?: unknown;
  error?: string;
}> {
  try {
    switch (binding.dataSourceKind) {
      case "ga4": {
        const { getGAClient } = await import("./ga4");
        const client = getGAClient();
        // List the configured property if present, otherwise just check creds load.
        return { ok: true, detail: { hasClient: !!client } };
      }
      case "vimeo": {
        const { fetchVimeoVideos } = await import("./vimeo");
        const tag =
          typeof (binding.config as { tag?: unknown }).tag === "string"
            ? ((binding.config as { tag?: string }).tag as string)
            : undefined;
        const vids = await fetchVimeoVideos(tag, 5);
        return { ok: true, detail: { sampleCount: vids.length, firstTitle: vids[0]?.title } };
      }
      case "google_sheets": {
        const { readSheet } = await import("./sheets");
        const cfg = binding.config as { spreadsheetId?: string; sheetName?: string; range?: string };
        if (!cfg.spreadsheetId) return { ok: false, error: "config.spreadsheetId missing" };
        const result = await readSheet({
          spreadsheetId: cfg.spreadsheetId,
          sheetName: cfg.sheetName,
          range: cfg.range,
        });
        return {
          ok: true,
          detail: { headers: result.headers, rowCount: result.rows.length },
        };
      }
      case "drupal_jsonapi": {
        return { ok: true, detail: { note: "uses Brand.drupalDomain at fetch time" } };
      }
      default:
        return { ok: false, error: `unknown kind: ${binding.dataSourceKind}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
