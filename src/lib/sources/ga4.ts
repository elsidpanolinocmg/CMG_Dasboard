import { BetaAnalyticsDataClient } from "@google-analytics/data";

let client: BetaAnalyticsDataClient | null = null;

function getCredentials(): object {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  return JSON.parse(raw);
}

export function getGAClient(): BetaAnalyticsDataClient {
  if (client) return client;
  client = new BetaAnalyticsDataClient({ credentials: getCredentials() as never });
  return client;
}

function fmtPropertyId(id: string): string {
  return id.startsWith("properties/") ? id : `properties/${id}`;
}

export async function fetchActiveNow(propertyId: string): Promise<number> {
  const ga = getGAClient();
  const [resp] = await ga.runRealtimeReport({
    property: fmtPropertyId(propertyId),
    metrics: [{ name: "activeUsers" }],
  });
  const cell = resp.rows?.[0]?.metricValues?.[0]?.value;
  return cell ? Number(cell) : 0;
}

export async function fetchActiveWindow(propertyId: string, days: number): Promise<number> {
  const ga = getGAClient();
  const [resp] = await ga.runReport({
    property: fmtPropertyId(propertyId),
    metrics: [{ name: "activeUsers" }],
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
  });
  const cell = resp.rows?.[0]?.metricValues?.[0]?.value;
  return cell ? Number(cell) : 0;
}

export async function fetchActiveToday(propertyId: string): Promise<number> {
  return fetchActiveWindow(propertyId, 0);
}
