import { BetaAnalyticsDataClient } from "@google-analytics/data";
import * as cheerio from "cheerio";
import BRAND_PROPERTIES_RAW from "../../../../../data/seed/brand_properties.json";
import GA4_PROPERTIES_RAW from "../../../../../data/seed/brand_ga4_properties.json";
import * as peopleRepo from "@/lib/repos/people";
import * as pageSettings from "@/lib/repos/pageSettings";
import { normalizeKey } from "@/lib/util/normalizeKey";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import {
  parseAdvancedSettings,
  passesBrandFilter,
  isPathExcluded,
  type AdvancedSettings,
} from "@/lib/util/brandFilters";
import EditorialLeaderboard, {
  type AuthorRow,
  type ArticleRow,
} from "./EditorialLeaderboard";
import AutoHideBanner from "./AutoHideBanner";
import BirthdayOverlay from "@/components/BirthdayOverlay";
import { RANGE_OPTIONS, SECTION_OPTIONS, pathMatchesSection, type RangeKey } from "./range";

const PAGE_KEY = "dashboard/editorial/leaderboard";

// Mirrors the schema defaultValue for the "advanced" field — applied when the
// admin has never saved an override for this page. Saving an empty object in
// the admin UI clears the filter.
const DEFAULT_ADVANCED: AdvancedSettings = {
  excludePathIncludes: ["/commentary/"],
  dedupCrosspostsByPath: true,
};

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
  gm: "govmedia.com",
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
    `https://${SOURCE_DOMAIN}/article_summary?show=28707` +
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

type LeaderboardSnapshot = {
  authors: AuthorRow[];
  brandErrors: { brand: string; error: string }[];
  rosterError: string | null;
  rosterCount: number;
};

async function loadLeaderboard({
  from,
  to,
  sectionSlug,
}: {
  from: string;
  to: string;
  sectionSlug: string;
}): Promise<LeaderboardSnapshot> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var not set.");
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

  const [scraped, savedSettings] = await Promise.all([
    fetchAllArticles(from, to),
    pageSettings.findByKey(PAGE_KEY).catch(() => null),
  ]);
  const savedAdvanced = (savedSettings?.settings as Record<string, unknown> | undefined)?.advanced;
  const advanced =
    savedAdvanced !== undefined
      ? parseAdvancedSettings(savedAdvanced)
      : DEFAULT_ADVANCED;

  const articlesByBrand = new Map<string, ScrapedArticle[]>();
  for (const a of scraped) {
    const brand = HOST_TO_BRAND.get(a.host);
    if (!brand) continue;
    if (isPathExcluded(a.alias, advanced)) continue;
    if (!passesBrandFilter(brand, a.alias, advanced)) continue;
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

  // Crosspost dedup: when the same article path appears across multiple QSR
  // brand domains (e.g. qsrmedia.com vs qsrmedia.com.au), keep only the row
  // with the largest views and recompute the author's totals/brand list. The
  // page-level default is `true`; saved advanced JSON can opt out with
  // `"dedupCrosspostsByPath": false`.
  if (advanced.dedupCrosspostsByPath !== false) {
    for (const author of authorMap.values()) {
      const byPath = new Map<string, ArticleRow>();
      for (const a of author.articles) {
        const cur = byPath.get(a.alias);
        if (!cur || a.views > cur.views) byPath.set(a.alias, a);
      }
      if (byPath.size === author.articles.length) continue;
      author.articles = Array.from(byPath.values());
      author.totalViews = author.articles.reduce((sum, a) => sum + a.views, 0);
      author.brands = Array.from(new Set(author.articles.map((a) => a.brand)));
    }
  }
  const authors = Array.from(authorMap.values())
    .filter((a) => a.totalViews > 0)
    .sort((a, b) => b.totalViews - a.totalViews);
  for (const a of authors) {
    a.brands.sort();
    a.articles.sort((x, y) => y.views - x.views);
  }

  return { authors, brandErrors, rosterError, rosterCount };
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

  // Cache-first: the heavy work (HTML scrape + ~14 GA4 calls + roster join +
  // dedup) runs through the tiered cache so warm requests skip it entirely.
  // Stale-while-revalidate keeps slow refreshes off the request path; admins
  // can force a clear via /admin/cache (prefix `editorial:`) and saving the
  // page's settings auto-invalidates the prefix from the API route.
  const cache = getCache();
  const cacheKey = cacheKeys.editorialLeaderboard(rangeKey, sectionSlug);
  if (params.cache === "clear") {
    await cache.invalidate(cacheKey);
  }
  let snapshot: LeaderboardSnapshot;
  try {
    snapshot = await cache.getOrLoad<LeaderboardSnapshot>(
      cacheKey,
      () => loadLeaderboard({ from, to, sectionSlug }),
      { ttlMs: ttls.LEADERBOARD, staleMs: ttls.LEADERBOARD_STALE },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6">
        <div className="rounded border border-red-300 bg-red-50 p-6 text-red-800 text-sm">
          {message}
        </div>
      </div>
    );
  }
  const { authors, brandErrors, rosterError } = snapshot;

  return (
    <div className="min-h-screen max-w-screen overflow-auto bg-white text-gray-900">
      {/* Error banners only (no always-on "filtering" info notice — it pushed the
          fixed-height leaderboard down and clipped the Total row on mobile).
          Overlaid + pointer-events-none so it can never offset the layout or block
          taps on the controls beneath. */}
      {(rosterError || brandErrors.length > 0) && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[70]">
          <AutoHideBanner>
            {rosterError && (
              <div className="bg-red-50 border-b border-red-200 text-red-900 text-xs px-4 py-2">
                Editorial roster unavailable — {rosterError}. Leaderboard will be empty until
                the editorial people collection is populated.
              </div>
            )}
            {brandErrors.length > 0 && (
              <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2">
                {brandErrors.length} brand{brandErrors.length === 1 ? "" : "s"} skipped:{" "}
                {brandErrors.map((e) => `${e.brand} (${e.error})`).join(", ")}
              </div>
            )}
          </AutoHideBanner>
        </div>
      )}
      <EditorialLeaderboard
        authors={authors}
        rangeKey={rangeKey}
        rangeLabel={label}
        sectionSlug={sectionSlug}
        brandCount={Object.keys(BRAND_DOMAINS).length}
      />
      <BirthdayOverlay pageKey="dashboard/editorial/leaderboard" />
    </div>
  );
}
