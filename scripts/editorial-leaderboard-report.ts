// Run with: npx tsx scripts/editorial-leaderboard-report.ts [--range=30d|7d|week|month] [--section=news] [--no-dedup]
//
// Mirrors the editorial leaderboard pipeline (scrape ABF article_summary →
// fetch GA4 views per brand → join with editorial roster → optional crosspost
// dedup) and writes per-author + per-article reports to reports/.

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import * as cheerio from "cheerio";

import BRAND_PROPERTIES_RAW from "../data/seed/brand_properties.json";
import GA4_PROPERTIES_RAW from "../data/seed/brand_ga4_properties.json";
import { normalizeKey } from "../src/lib/util/normalizeKey";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

type RangeKey = "7d" | "30d" | "week" | "month";

const SOURCE_DOMAIN = "asianbankingandfinance.net";
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

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

type ScrapedArticle = {
  title: string;
  alias: string;
  host: string;
  authorName: string;
};

type ArticleRow = {
  brand: string;
  brandName: string;
  domain: string;
  title: string;
  alias: string;
  authorName: string;
  views: number;
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
  }
  return { from: isoDate(from), to: today, label };
}

async function fetchListPage(page: number, from: string, to: string): Promise<ScrapedArticle[]> {
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
    const batch = await Promise.all(pages.map((p) => fetchListPage(p, from, to)));
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

function pathMatchesSection(path: string, slug: string): boolean {
  if (!slug) return true;
  const needle = "/" + slug.toLowerCase();
  const lower = path.toLowerCase();
  return lower === needle || lower.startsWith(needle + "/") || lower.includes(needle + "/");
}

function parseArgs(argv: string[]): { range: RangeKey; section: string; dedup: boolean } {
  let range: RangeKey = "30d";
  let section = "";
  let dedup = true;
  for (const a of argv.slice(2)) {
    if (a.startsWith("--range=")) {
      const v = a.slice(8);
      if (v === "7d" || v === "30d" || v === "week" || v === "month") range = v;
    } else if (a.startsWith("--section=")) {
      section = a.slice(10).toLowerCase();
    } else if (a === "--no-dedup") {
      dedup = false;
    }
  }
  return { range, section, dedup };
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const { range, section, dedup } = parseArgs(process.argv);
  const { from, to, label } = computeDateRange(range);
  console.log(`Range: ${label} (${from} → ${to})${section ? `  Section: ${section}` : ""}  Dedup: ${dedup}`);

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!uri || !dbName) {
    console.error("MONGODB_URI and MONGODB_DB must be set");
    process.exit(1);
  }
  if (!sa) {
    console.error("GOOGLE_SERVICE_ACCOUNT_JSON must be set");
    process.exit(1);
  }

  const creds = JSON.parse(sa) as { private_key: string; client_email: string };
  if (creds.private_key && creds.private_key.includes("\\n")) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  const ga = new BetaAnalyticsDataClient({ credentials: creds });

  const mongo = new MongoClient(uri);
  await mongo.connect();

  try {
    const db = mongo.db(dbName);

    const team = await db
      .collection("people")
      .find({ "departments.departmentSlug": "editorial" })
      .toArray();
    console.log(`Editorial roster: ${team.length} members`);
    const teamByKey = new Map<string, { displayName: string }>();
    for (const p of team) {
      const displayName = (p as { displayName?: string }).displayName ?? "";
      const nameKeys = ((p as { nameKeys?: string[] }).nameKeys ?? []) as string[];
      for (const k of nameKeys) {
        if (!teamByKey.has(k)) teamByKey.set(k, { displayName });
      }
    }

    console.log("Scraping article list…");
    const scraped = await fetchAllArticles(from, to);
    console.log(`Scraped ${scraped.length} articles total.`);

    // Mirrors the page-side default for editorial leaderboard advanced settings.
    const EXCLUDE_PATH_INCLUDES = ["/commentary/"];
    const articlesByBrand = new Map<string, ScrapedArticle[]>();
    for (const a of scraped) {
      const brand = HOST_TO_BRAND.get(a.host);
      if (!brand) continue;
      if (EXCLUDE_PATH_INCLUDES.some((needle) => a.alias.includes(needle))) continue;
      if (!pathMatchesSection(a.alias, section)) continue;
      const list = articlesByBrand.get(brand) ?? [];
      list.push(a);
      articlesByBrand.set(brand, list);
    }
    console.log(`Brands with articles: ${articlesByBrand.size}`);

    console.log("Fetching GA4 views per brand…");
    const ga4Results = await Promise.all(
      Array.from(articlesByBrand.entries()).map(async ([brand, articles]) => {
        const propertyId = GA4_PROPS[brand];
        if (!propertyId) return { brand, error: "no GA4 property", views: new Map<string, number>() };
        try {
          const paths = articles.map((a) => a.alias);
          const views = await fetchPageViews(ga, propertyId, paths, from, to);
          return { brand, views, error: null as string | null };
        } catch (e) {
          return { brand, views: new Map<string, number>(), error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    const viewsByBrand = new Map(ga4Results.map((r) => [r.brand, r.views]));
    for (const r of ga4Results) {
      if (r.error) console.warn(`  ${r.brand}: GA4 error — ${r.error}`);
    }

    const allRows: ArticleRow[] = [];
    for (const [brand, articles] of articlesByBrand) {
      const brandName = BRAND_PROPERTIES[brand]?.name ?? brand;
      const domain = BRAND_DOMAINS[brand];
      const views = viewsByBrand.get(brand) ?? new Map<string, number>();
      for (const a of articles) {
        allRows.push({
          brand,
          brandName,
          domain,
          title: a.title,
          alias: a.alias,
          authorName: a.authorName,
          views: views.get(a.alias) ?? 0,
        });
      }
    }

    type AuthorBucket = {
      authorName: string;
      brands: string[];
      articles: ArticleRow[];
      totalViews: number;
    };
    const authorMap = new Map<string, AuthorBucket>();
    for (const row of allRows) {
      if (!row.authorName) continue;
      const k = normalizeKey(row.authorName);
      const member = teamByKey.get(k);
      if (!member) continue;
      const canonical = member.displayName;
      const key = canonical.toLowerCase();
      const g = authorMap.get(key) ?? {
        authorName: canonical,
        brands: [],
        articles: [],
        totalViews: 0,
      };
      if (!g.brands.includes(row.brand)) g.brands.push(row.brand);
      g.articles.push(row);
      g.totalViews += row.views;
      authorMap.set(key, g);
    }

    if (dedup) {
      for (const author of authorMap.values()) {
        const byPath = new Map<string, ArticleRow>();
        for (const a of author.articles) {
          const cur = byPath.get(a.alias);
          if (!cur || a.views > cur.views) byPath.set(a.alias, a);
        }
        if (byPath.size === author.articles.length) continue;
        author.articles = Array.from(byPath.values());
        author.totalViews = author.articles.reduce((s, a) => s + a.views, 0);
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

    await mkdir("reports", { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const baseName = `editorial-leaderboard_${range}_${from}_to_${to}${section ? `_${section}` : ""}${dedup ? "" : "_nodedup"}_${stamp}`;
    const jsonPath = `reports/${baseName}.json`;
    const csvPath = `reports/${baseName}.csv`;

    await writeFile(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          range: { key: range, label, from, to },
          section: section || null,
          dedupCrosspostsByPath: dedup,
          totals: {
            authors: authors.length,
            articles: authors.reduce((s, a) => s + a.articles.length, 0),
            views: authors.reduce((s, a) => s + a.totalViews, 0),
          },
          authors,
        },
        null,
        2,
      ),
      "utf8",
    );

    const csvRows: string[] = [
      ["author", "rank", "brand", "brand_name", "domain", "title", "url", "views"]
        .map(csvEscape)
        .join(","),
    ];
    authors.forEach((author, idx) => {
      const rank = idx + 1;
      for (const a of author.articles) {
        csvRows.push(
          [
            author.authorName,
            rank,
            a.brand,
            a.brandName,
            a.domain,
            a.title,
            `https://${a.domain}${a.alias}`,
            a.views,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    });
    await writeFile(csvPath, csvRows.join("\r\n"), "utf8");

    console.log(`\nAuthors with views: ${authors.length}`);
    console.log(`Total articles: ${authors.reduce((s, a) => s + a.articles.length, 0)}`);
    console.log(`Total views:    ${authors.reduce((s, a) => s + a.totalViews, 0)}`);
    console.log(`\nWrote: ${jsonPath}`);
    console.log(`Wrote: ${csvPath}`);

    console.log("\nTop 10 authors:");
    for (let i = 0; i < Math.min(10, authors.length); i++) {
      const a = authors[i];
      console.log(`  ${i + 1}. ${a.authorName} — ${a.totalViews} views, ${a.articles.length} articles`);
    }
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
