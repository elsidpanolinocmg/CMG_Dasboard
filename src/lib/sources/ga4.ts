import { BetaAnalyticsDataClient } from "@google-analytics/data";

let client: BetaAnalyticsDataClient | null = null;

function getCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const parsed = JSON.parse(raw) as { client_email: string; private_key: string };
  // If the env loader left `\n` as literal backslash-n inside the PEM, fix it.
  if (parsed.private_key && parsed.private_key.includes("\\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

export function getGAClient(): BetaAnalyticsDataClient {
  if (client) return client;
  client = new BetaAnalyticsDataClient({ credentials: getCredentials() as never });
  return client;
}

function fmtPropertyId(id: string): string {
  return id.startsWith("properties/") ? id : `properties/${id}`;
}

export interface Ga4DimensionFilter {
  fieldName: string;
  matchType: string;
  value: string;
}

function buildDimensionFilter(filter?: Ga4DimensionFilter) {
  if (!filter) return undefined;
  return {
    filter: {
      fieldName: filter.fieldName,
      stringFilter: { matchType: filter.matchType, value: filter.value },
    },
  };
}

export async function fetchActiveNow(
  propertyId: string,
  filter?: Ga4DimensionFilter,
): Promise<number> {
  const ga = getGAClient();
  const req: Record<string, unknown> = {
    property: fmtPropertyId(propertyId),
    metrics: [{ name: "activeUsers" }],
  };
  const df = buildDimensionFilter(filter);
  if (df) req.dimensionFilter = df;
  try {
    const [resp] = await ga.runRealtimeReport(req as never);
    const value =
      resp.totals?.[0]?.metricValues?.[0]?.value ??
      resp.rows?.[0]?.metricValues?.[0]?.value;
    return value ? Number(value) : 0;
  } catch (err) {
    console.error("[ga4.fetchActiveNow] property=", propertyId, "err=", err);
    throw err;
  }
}

export async function fetchActiveWindow(
  propertyId: string,
  days: number,
  filter?: Ga4DimensionFilter,
): Promise<number> {
  const ga = getGAClient();
  const startDate = days === 0 ? "today" : `${days}daysAgo`;
  const req: Record<string, unknown> = {
    property: fmtPropertyId(propertyId),
    metrics: [{ name: "activeUsers" }],
    dateRanges: [{ startDate, endDate: "today" }],
  };
  const df = buildDimensionFilter(filter);
  if (df) req.dimensionFilter = df;
  const [resp] = await ga.runReport(req as never);
  const value =
    resp.totals?.[0]?.metricValues?.[0]?.value ??
    resp.rows?.[0]?.metricValues?.[0]?.value;
  return value ? Number(value) : 0;
}

export async function fetchActiveToday(
  propertyId: string,
  filter?: Ga4DimensionFilter,
): Promise<number> {
  return fetchActiveWindow(propertyId, 0, filter);
}
