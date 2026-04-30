import { BetaAnalyticsDataClient } from "@google-analytics/data";
import * as cheerio from "cheerio";
import BRAND_PROPERTIES_RAW from "../../../../../data/seed/brand_properties.json";
import GA4_PROPERTIES_RAW from "../../../../../data/seed/brand_ga4_properties.json";
import * as peopleRepo from "@/lib/repos/people";
import { normalizeKey } from "@/lib/util/normalizeKey";
import EditorialLeaderboard, {
  type AuthorRow,
  type ArticleRow,
} from "./EditorialLeaderboard";
import AutoHideBanner from "./AutoHideBanner";
import { RANGE_OPTIONS, SECTION_OPTIONS, pathMatchesSection, type RangeKey } from "./range";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE_DOMAIN = "asianbankingandfinance.net"; // any one brand works — view is CMG-wide
const MAX_PAGES = 60;
const PAGE_BATCH_SIZE = 10;

const BRAND_DOMAINS: Record<string, string> = {
  sbr: "sbr.com.sg",
  hkb: "hongkongbusiness.hk",
  abf: "asianbankingandfinance.net",
  abr: "asianbusinessreview.com",
  ia: "insuranceasia.com",
  ra: "retailasia.com",
  ap: "asian-power.com",
  hca: "healthcareasiamagazine.com",
  qsr: "qsrmedia.com",
  "qsr-asia": "qsrmedia.asia",
  "qsr-aus": "qsrmedia.com.au",
  "qsr-uk": "qsrmedia.co.uk",
  esgb: "esgbusiness.com",
  gm: "govmedia.asia",
  invest: "investmentasia.net",
  mir: "marineindustrial.com",
  rea: "realestateasia.com",
  ma: "manufacturing.asia",
};

const BRAND_PROPERTIES = BRAND_PROPERTIES_RAW as Record<string, { name: string }>;
const GA4_PROPS = GA4_PROPERTIES_RAW as Record<string, string>;

const HOST_TO_BRAND = new Map<string, string>(
  Object.entries(BRAND_DOMAINS).map(([brand, host]) => [host, brand]),
);

type ScrapedArticle = {
  title: string;
  alias: string;
  host: string;
  authorName: string;
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeDateRange(key: RangeKey): { from: string; to: string; label: string } {
  const now = new Date();
  const today = isoDate(now);
  let from: Date;
  let label: string;
  switch (key) {
    case "7d":
      from = new Date(now.getTime() - 7 * 86400000);
      label = "last 7 days";
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 86400000);
      label = "last 30 days";
      break;
    case "week": {
      const dow = now.getDay() || 7;
      from = new Date(now);
      from.setDate(now.getDate() - (dow - 1));
      label = "this week";
      break;
    }
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "this month";
      break;
    default:
      from = new Date(now.getTime() - 30 * 86400000);
      label = "last 30 days";
  }
  return { from: isoDate(from), to: today, label };
}

async function fetchPage(page: number, from: string, to: string): Promise<ScrapedArticle[]> {
  const url =
    `https://${SOURCE_DOMAIN}/article_summary?show=28706` +
    `&exposed_from_date=${from}&exposed_to_date=${to}` +
    (page > 0 ? `&page=${page}` : "");
  try {
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: "text/html,application/xhtml+xml", Referer: `https://${SOURCE_DOMAIN}/` },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const out: ScrapedArticle[] = [];
    $("table.cols-3 tbody tr.item").each((_, tr) => {
      const $tr = $(tr);
      const title = ($tr.find("td.views-field-field-domain-access-1 span.title").attr("title") ?? "").trim();
      const href = ($tr.find("td.views-field-field-domain-access-1 a").attr("href") ?? "").trim();
      const author = $tr.find("td.views-field-field-uploaded-by").text().trim();
      if (!title || !href) return;
      try {
        const u = new URL(href);
        out.push({ title, alias: u.pathname, host: u.hostname, authorName: author });
      } catch {}
    });
    return out;
  } catch {
    return [];
  }
}

async function fetchAllArticles(from: string, to: string): Promise<ScrapedArticle[]> {
  const all: ScrapedArticle[] = [];
  for (let start = 0; start < MAX_PAGES; start += PAGE_BATCH_SIZE) {
    const pages = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, MAX_PAGES - start) },
      (_, i) => start + i,
    );
    const batch = await Promise.all(pages.map((p) => fetchPage(p, from, to)));
    let sawEmpty = false;
    for (const rows of batch) {
      if (rows.length === 0) sawEmpty = true;
      all.push(...rows);
    }
    if (sawEmpty) break;
  }
  return all;
}

async function fetchPageViews(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  paths: string[],
  from: string,
  to: string,
): Promise<Map<string, number>> {
  if (paths.length === 0) return new Map();
  const [resp] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        inListFilter: { values: paths, caseSensitive: false },
      },
    },
    limit: 1000,
  });
  const out = new Map<string, number>();
  for (const row of resp.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? "";
    const views = Number(row.metricValues?.[0]?.value ?? 0);
    const key = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
    out.set(key, (out.get(key) ?? 0) + views);
  }
  return out;
}

function isValidRange(s: string | undefined): s is RangeKey {
  return !!s && RANGE_OPTIONS.some((o) => o.value === s);
}

function normalizeSection(s: string | undefined): string {
  if (!s) return "";
  const v = s.trim().toLowerCase();
  return SECTION_OPTIONS.some((o) => o.value === v) ? v : "";
}

export default async function EditorialLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cache?: string; range?: string; section?: string }>;
}) {
  const params = await searchParams;
  const rangeKey: RangeKey = isValidRange(params.range) ? params.range : "30d";
  const sectionSlug = normalizeSection(params.section);
  const { from, to, label } = computeDateRange(rangeKey);

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6">
        <div className="rounded border border-red-300 bg-red-50 p-6 text-red-800 text-sm">
          GOOGLE_SERVICE_ACCOUNT_JSON env var not set.
        </div>
      </div>
    );
  }
  const creds = JSON.parse(raw) as { private_key: string; client_email: string };
  if (creds.private_key && creds.private_key.includes("\\n")) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  const client = new BetaAnalyticsDataClient({ credentials: creds });

  // Editorial roster sourced from CMG people collection.
  let rosterError: string | null = null;
  let rosterCount = 0;
  const teamByKey = new Map<string, { displayName: string }>();
  try {
    const team = await peopleRepo.listByDepartment("editorial");
    rosterCount = team.length;
    if (rosterCount === 0) {
      rosterError = "no editorial team members in people collection";
    }
    for (const p of team) {
      for (const k of p.nameKeys ?? []) {
        if (!teamByKey.has(k)) teamByKey.set(k, { displayName: p.displayName });
      }
    }
  } catch (e) {
    rosterError = e instanceof Error ? e.message : String(e);
  }

  const scraped = await fetchAllArticles(from, to);

  const articlesByBrand = new Map<string, ScrapedArticle[]>();
  for (const a of scraped) {
    const brand = HOST_TO_BRAND.get(a.host);
    if (!brand) continue;
    if (!pathMatchesSection(a.alias, sectionSlug)) continue;
    const list = articlesByBrand.get(brand) ?? [];
    list.push(a);
    articlesByBrand.set(brand, list);
  }

  const ga4Results = await Promise.all(
    Array.from(articlesByBrand.entries()).map(async ([brand, articles]) => {
      const propertyId = GA4_PROPS[brand];
      if (!propertyId) return { brand, error: "no GA4 property", views: new Map() };
      try {
        const paths = articles.map((a) => a.alias);
        const views = await fetchPageViews(client, propertyId, paths, from, to);
        return { brand, views, error: null as string | null };
      } catch (e) {
        return { brand, views: new Map<string, number>(), error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  const viewsByBrand = new Map(ga4Results.map((r) => [r.brand, r.views]));
  const brandErrors = ga4Results
    .filter((r) => r.error)
    .map((r) => ({ brand: r.brand, error: `GA4: ${r.error!}` }));

  const allRows: ArticleRow[] = [];
  let nidCounter = 0;
  for (const [brand, articles] of articlesByBrand) {
    const brandName = BRAND_PROPERTIES[brand]?.name ?? brand;
    const domain = BRAND_DOMAINS[brand];
    const views = viewsByBrand.get(brand) ?? new Map();
    for (const a of articles) {
      allRows.push({
        brand,
        brandName,
        domain,
        nid: nidCounter++,
        title: a.title,
        alias: a.alias,
        authorName: a.authorName,
        views: views.get(a.alias) ?? 0,
      });
    }
  }

  // Strict editorial-only: if the roster wasn't loaded, no rows survive.
  // This avoids accidentally surfacing non-editorial authors on a DB hiccup.
  const authorMap = new Map<string, AuthorRow>();
  if (!rosterError && rosterCount > 0) {
    for (const row of allRows) {
      if (!row.authorName) continue;
      const k = normalizeKey(row.authorName);
      const member = teamByKey.get(k);
      if (!member) continue;
      const canonicalName = member.displayName;
      const key = canonicalName.toLowerCase();
      const g = authorMap.get(key) ?? {
        authorName: canonicalName,
        brands: [],
        articles: [],
        totalViews: 0,
      };
      if (!g.brands.includes(row.brand)) g.brands.push(row.brand);
      g.articles.push(row);
      g.totalViews += row.views;
      authorMap.set(key, g);
    }
  }
  const authors = Array.from(authorMap.values())
    .filter((a) => a.totalViews > 0)
    .sort((a, b) => b.totalViews - a.totalViews);
  for (const a of authors) {
    a.brands.sort();
    a.articles.sort((x, y) => y.views - x.views);
  }

  return (
    <div className="min-h-screen max-w-screen overflow-auto bg-white text-gray-900">
      {(rosterError || rosterCount > 0 || brandErrors.length > 0) && (
        <AutoHideBanner>
          {rosterError && (
            <div className="bg-red-50 border-b border-red-200 text-red-900 text-xs px-4 py-2">
              Editorial roster unavailable — {rosterError}. Leaderboard will be empty until
              the editorial people collection is populated.
            </div>
          )}
          {!rosterError && rosterCount > 0 && (
            <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs px-4 py-2">
              Filtering to {rosterCount} editorial team members from the DB roster.
            </div>
          )}
          {brandErrors.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2">
              {brandErrors.length} brand{brandErrors.length === 1 ? "" : "s"} skipped:{" "}
              {brandErrors.map((e) => `${e.brand} (${e.error})`).join(", ")}
            </div>
          )}
        </AutoHideBanner>
      )}
      <EditorialLeaderboard
        authors={authors}
        rangeKey={rangeKey}
        rangeLabel={label}
        sectionSlug={sectionSlug}
        brandCount={Object.keys(BRAND_DOMAINS).length}
      />
    </div>
  );
}
