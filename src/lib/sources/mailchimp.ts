import "server-only";
import {
  LEAD_SOURCE_BUCKETS,
  type AudienceMovement,
  type CampaignWindowStats,
  type LeadSourceBucket,
  type LeadSourceMovement,
  type MailchimpAudienceStats,
} from "./mailchimpTypes";

// Re-export shared types so existing call sites that import them from this
// module keep working.
export {
  LEAD_SOURCE_BUCKETS,
  type AudienceMovement,
  type CampaignWindowStats,
  type LeadSourceBucket,
  type LeadSourceMovement,
  type MailchimpAudienceStats,
} from "./mailchimpTypes";

export type MailchimpAccountConfig = {
  apiKey: string;
  server: string;
  listId: string;
};

type ListResponse = {
  id: string;
  name?: string;
  stats?: {
    member_count?: number;
    unsubscribe_count?: number;
    cleaned_count?: number;
    total_contacts?: number;
    open_rate?: number;
    click_rate?: number;
  };
};

type MemberMergeFields = { MMERGE9?: string };
type MembersResponse = {
  members: { merge_fields?: MemberMergeFields }[];
  total_items: number;
};

function parseAccounts(): Record<string, MailchimpAccountConfig> {
  const raw = process.env.MAILCHIMP_ACCOUNTS_JSON;
  if (!raw) throw new Error("MAILCHIMP_ACCOUNTS_JSON env var not set.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`MAILCHIMP_ACCOUNTS_JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MAILCHIMP_ACCOUNTS_JSON must be an object keyed by account title.");
  }
  const out: Record<string, MailchimpAccountConfig> = {};
  for (const [title, value] of Object.entries(parsed as Record<string, unknown>)) {
    const v = value as Partial<MailchimpAccountConfig>;
    if (!v?.apiKey || !v?.server || !v?.listId) {
      throw new Error(`MAILCHIMP_ACCOUNTS_JSON["${title}"] is missing apiKey/server/listId.`);
    }
    out[title] = { apiKey: v.apiKey, server: v.server, listId: v.listId };
  }
  return out;
}

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`any:${apiKey}`).toString("base64");
}

// Some MMERGE9 values are CSV-style concats (e.g. "Awards page sign-up, Awards page sign-up").
// Pick the first non-empty token.
function primaryToken(raw: string | undefined): string {
  if (!raw) return "";
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t) return t;
  }
  return "";
}

export function classifyLeadSource(rawValue: string | undefined): LeadSourceBucket {
  const v = primaryToken(rawValue).toLowerCase();
  if (!v) return "Other";
  if (/newsletter\s*sign[-\s]?up/.test(v)) return "Newsletter sign-up";
  if (/^bizcon\b|\brsvp\b|\bevent\b|\bedm\b/.test(v)) return "Events";
  if (/awards/.test(v)) return "Awards";
  if (/moody|s&p|standard\s*&\s*poor|fortune|forbes|biz\s*cards?|top\s*\d|apac\s+banks?|apac\s+nbfi/.test(v))
    return "Top banks / companies";
  if (/facebook\s*ads?|linkedin\s*ads?|google\s*ads?|paid\s*social|paid\s*search|gads/.test(v)) return "Paid Ads";
  return "Other";
}

function emptyBuckets(): Record<LeadSourceBucket, LeadSourceMovement> {
  const out = {} as Record<LeadSourceBucket, LeadSourceMovement>;
  for (const b of LEAD_SOURCE_BUCKETS) {
    out[b] = { bucket: b, subscribed: 0, unsubscribed: 0, cleaned: 0 };
  }
  return out;
}

async function fetchOneStats(
  title: string,
  account: MailchimpAccountConfig,
): Promise<MailchimpAudienceStats> {
  const url =
    `https://${account.server}.api.mailchimp.com/3.0/lists/${account.listId}` +
    `?fields=id,name,stats.member_count,stats.unsubscribe_count,stats.cleaned_count,` +
    `stats.total_contacts,stats.open_rate,stats.click_rate`;

  const empty: MailchimpAudienceStats = {
    title,
    listId: account.listId,
    server: account.server,
    listName: null,
    memberCount: 0,
    unsubscribeCount: 0,
    cleanedCount: 0,
    totalContacts: 0,
    openRate: null,
    clickRate: null,
    unsubscribeRate: null,
    error: null,
  };

  try {
    const res = await fetch(url, {
      headers: { Authorization: authHeader(account.apiKey), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ...empty, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}` };
    }
    const data = (await res.json()) as ListResponse;
    const members = data.stats?.member_count ?? 0;
    const unsubs = data.stats?.unsubscribe_count ?? 0;
    const denom = members + unsubs;
    return {
      ...empty,
      listName: data.name ?? null,
      memberCount: members,
      unsubscribeCount: unsubs,
      cleanedCount: data.stats?.cleaned_count ?? 0,
      totalContacts: data.stats?.total_contacts ?? 0,
      openRate: typeof data.stats?.open_rate === "number" ? data.stats.open_rate : null,
      clickRate: typeof data.stats?.click_rate === "number" ? data.stats.click_rate : null,
      unsubscribeRate: denom > 0 ? (unsubs / denom) * 100 : null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchAllAudiences(): Promise<MailchimpAudienceStats[]> {
  const accounts = parseAccounts();
  const entries = Object.entries(accounts);
  const rows = await Promise.all(entries.map(([title, cfg]) => fetchOneStats(title, cfg)));
  rows.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    return b.memberCount - a.memberCount;
  });
  return rows;
}

async function fetchMembersByStatus(
  account: MailchimpAccountConfig,
  status: "subscribed" | "unsubscribed" | "cleaned",
  sinceIso: string,
): Promise<{ members: MembersResponse["members"]; truncated: boolean }> {
  // Mailchimp filters by signup time for subscribed (`since_timestamp_opt`),
  // and by `last_changed` for status transitions (unsub/cleaned).
  const param = status === "subscribed" ? "since_timestamp_opt" : "since_last_changed";
  const url =
    `https://${account.server}.api.mailchimp.com/3.0/lists/${account.listId}/members` +
    `?status=${status}&${param}=${encodeURIComponent(sinceIso)}` +
    `&count=1000&fields=members.merge_fields.MMERGE9,total_items`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(account.apiKey), Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${status}`);
  }
  const data = (await res.json()) as MembersResponse;
  return { members: data.members, truncated: data.total_items > data.members.length };
}

async function fetchOneMovement(
  title: string,
  account: MailchimpAccountConfig,
  sinceIso: string,
): Promise<AudienceMovement> {
  const buckets = emptyBuckets();
  try {
    const [subs, unsubs, cleaned] = await Promise.all([
      fetchMembersByStatus(account, "subscribed", sinceIso),
      fetchMembersByStatus(account, "unsubscribed", sinceIso),
      fetchMembersByStatus(account, "cleaned", sinceIso),
    ]);
    for (const m of subs.members) buckets[classifyLeadSource(m.merge_fields?.MMERGE9)].subscribed++;
    for (const m of unsubs.members) buckets[classifyLeadSource(m.merge_fields?.MMERGE9)].unsubscribed++;
    for (const m of cleaned.members) buckets[classifyLeadSource(m.merge_fields?.MMERGE9)].cleaned++;
    const totals = {
      subscribed: subs.members.length,
      unsubscribed: unsubs.members.length,
      cleaned: cleaned.members.length,
    };
    return { title, listId: account.listId, byBucket: buckets, totals, error: null };
  } catch (e) {
    return {
      title,
      listId: account.listId,
      byBucket: buckets,
      totals: { subscribed: 0, unsubscribed: 0, cleaned: 0 },
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function fetchLeadSourceMovement(
  days: number,
): Promise<{
  perAudience: AudienceMovement[];
  totals: Record<LeadSourceBucket, LeadSourceMovement>;
  grandTotals: { subscribed: number; unsubscribed: number; cleaned: number };
  windowDays: number;
}> {
  const accounts = parseAccounts();
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
  const perAudience = await Promise.all(
    Object.entries(accounts).map(([title, cfg]) => fetchOneMovement(title, cfg, sinceIso)),
  );
  perAudience.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    return b.totals.subscribed - a.totals.subscribed;
  });
  const totals = emptyBuckets();
  const grandTotals = { subscribed: 0, unsubscribed: 0, cleaned: 0 };
  for (const aud of perAudience) {
    for (const b of LEAD_SOURCE_BUCKETS) {
      totals[b].subscribed += aud.byBucket[b].subscribed;
      totals[b].unsubscribed += aud.byBucket[b].unsubscribed;
      totals[b].cleaned += aud.byBucket[b].cleaned;
    }
    grandTotals.subscribed += aud.totals.subscribed;
    grandTotals.unsubscribed += aud.totals.unsubscribed;
    grandTotals.cleaned += aud.totals.cleaned;
  }
  return { perAudience, totals, grandTotals, windowDays: days };
}

type ReportsApiResponse = {
  reports?: {
    id?: string;
    list_id?: string;
    send_time?: string;
    emails_sent?: number;
    opens?: {
      unique_opens?: number;
      // Privacy-aware open count Mailchimp's own UI uses post-MPP. Falls back
      // to unique_opens for older reports where this field isn't populated.
      proxy_excluded_unique_opens?: number;
    };
    clicks?: { unique_clicks?: number };
  }[];
  total_items?: number;
};

async function fetchOneReports(
  title: string,
  account: MailchimpAccountConfig,
  sinceIso: string,
): Promise<CampaignWindowStats> {
  // Mailchimp's /reports endpoint pages with offset; 1000 is the max per page.
  // For per-list filters within a 90-day window we expect well under 1000
  // campaigns so a single page is normally enough.
  const url =
    `https://${account.server}.api.mailchimp.com/3.0/reports` +
    `?count=1000&list_id=${encodeURIComponent(account.listId)}` +
    `&since_send_time=${encodeURIComponent(sinceIso)}` +
    `&fields=reports.emails_sent,reports.opens.unique_opens,reports.opens.proxy_excluded_unique_opens,reports.clicks.unique_clicks,total_items`;

  const empty: CampaignWindowStats = {
    title,
    listId: account.listId,
    campaignsCount: 0,
    sends: 0,
    uniqueOpens: 0,
    uniqueClicks: 0,
    openRate: null,
    clickRate: null,
    ctor: null,
    error: null,
  };

  try {
    const res = await fetch(url, {
      headers: { Authorization: authHeader(account.apiKey), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ...empty, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}` };
    }
    const data = (await res.json()) as ReportsApiResponse;
    const reports = data.reports ?? [];
    let sends = 0;
    let opens = 0;
    let clicks = 0;
    for (const r of reports) {
      sends += r.emails_sent ?? 0;
      // Prefer the privacy-aware count so totals match Mailchimp's UI.
      opens += r.opens?.proxy_excluded_unique_opens ?? r.opens?.unique_opens ?? 0;
      clicks += r.clicks?.unique_clicks ?? 0;
    }
    return {
      ...empty,
      campaignsCount: reports.length,
      sends,
      uniqueOpens: opens,
      uniqueClicks: clicks,
      openRate: sends > 0 ? (opens / sends) * 100 : null,
      clickRate: sends > 0 ? (clicks / sends) * 100 : null,
      ctor: opens > 0 ? (clicks / opens) * 100 : null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchCampaignWindowStats(
  days: number,
): Promise<{
  perAudience: CampaignWindowStats[];
  grandTotals: {
    campaigns: number;
    sends: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number | null;
    clickRate: number | null;
    ctor: number | null;
  };
  windowDays: number;
}> {
  const accounts = parseAccounts();
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
  const perAudience = await Promise.all(
    Object.entries(accounts).map(([title, cfg]) => fetchOneReports(title, cfg, sinceIso)),
  );
  perAudience.sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    return b.sends - a.sends;
  });
  let campaigns = 0;
  let sends = 0;
  let opens = 0;
  let clicks = 0;
  for (const r of perAudience) {
    campaigns += r.campaignsCount;
    sends += r.sends;
    opens += r.uniqueOpens;
    clicks += r.uniqueClicks;
  }
  return {
    perAudience,
    grandTotals: {
      campaigns,
      sends,
      uniqueOpens: opens,
      uniqueClicks: clicks,
      openRate: sends > 0 ? (opens / sends) * 100 : null,
      clickRate: sends > 0 ? (clicks / sends) * 100 : null,
      ctor: opens > 0 ? (clicks / opens) * 100 : null,
    },
    windowDays: days,
  };
}
