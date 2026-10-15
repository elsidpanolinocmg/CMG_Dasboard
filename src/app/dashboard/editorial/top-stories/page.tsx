import { BetaAnalyticsDataClient } from "@google-analytics/data";
import * as cheerio from "cheerio";
import BRAND_PROPERTIES_RAW from "../../../../../data/seed/brand_properties.json";
import GA4_PROPERTIES_RAW from "../../../../../data/seed/brand_ga4_properties.json";
import { getCache, cacheKeys, ttls } from "@/lib/cache";
import TopStoriesClient, { type PeriodStories, type Story } from "./TopStoriesClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Same CMG-wide news brands the editorial leaderboard covers.
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

const BRAND_PROPERTIES = BRAND_PROPERTIES_RAW as Record<string, { name: string; image?: string }>;
const GA4_PROPS = GA4_PROPERTIES_RAW as Record<string, string>;

// Yesterday is the last complete day in GA4, so every window ends there.
const PERIODS = [
  { key: "daily", label: "Yesterday", startDate: "yesterday" },
  { key: "weekly", label: "Last 7 days", startDate: "7daysAgo" },
  { key: "monthly", label: "Last 30 days", startDate: "30daysAgo" },
] as const;

const TOP_N = 5;
const CANDIDATES = 10;
const PER_BRAND_ROWS = 40;
const BODY_PARAGRAPHS = 12;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const NON_ARTICLE_PREFIXES = ["/event", "/awards", "/videos", "/podcasts", "/search", "/tags", "/author", "/user"];
// Paid and gated content isn't editorial, so it shouldn't win "most read".
const NON_EDITORIAL_SEGMENTS = ["/white-paper/", "/co-written-partner/", "/sponsored/"];

// Article aliases end in a long hyphenated slug; section/landing pages don't.
function looksLikeArticle(path: string): boolean {
  const lower = path.toLowerCase();
  if (NON_ARTICLE_PREFIXES.some((p) => lower.startsWith(p))) return false;
  if (NON_EDITORIAL_SEGMENTS.some((s) => lower.includes(s))) return false;
  const last = lower.replace(/\/$/, "").split("/").pop() ?? "";
  return last.split("-").length >= 4;
}

// public/logo/trimmed holds copies of the brand logos with their blank margins
// cut off, so logos of different shapes fill the same box evenly. The page
// falls back to the original logo if a trimmed copy is missing.
function logoFor(image: string | undefined): string | null {
  if (!image) return null;
  return `/logo/trimmed/${image.split("/").pop()}`;
}

type Candidate = { brand: string; path: string; views: number };

async function topPathsForBrand(
  client: BetaAnalyticsDataClient,
  brand: string,
  startDate: string,
): Promise<Candidate[]> {
  const propertyId = GA4_PROPS[brand];
  if (!propertyId) return [];
  const [resp] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: "yesterday" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: PER_BRAND_ROWS,
  });
  const out: Candidate[] = [];
  for (const row of resp.rows ?? []) {
    const raw = row.dimensionValues?.[0]?.value ?? "";
    const path = raw.split("?")[0].replace(/\/$/, "");
    if (!looksLikeArticle(path)) continue;
    out.push({ brand, path, views: Number(row.metricValues?.[0]?.value ?? 0) });
  }
  return out;
}

type ArticleDetails = {
  title: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  body: string[];
  tags: string[];
  // True when the article had more paragraphs than we show.
  truncated: boolean;
};

async function fetchArticle(url: string): Promise<ArticleDetails | null> {
  try {
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: "text/html" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const title = ($("h1.nf__title").first().text() || $('meta[property="og:title"]').attr("content") || "").trim();
    // Skip promo blocks the site embeds inside the article body (newsletter
    // sign-up, "A note from …" conversion box).
    const allParagraphs = $(".nf__description p")
      .filter((_, p) => $(p).closest(".post-article-conversion, .block-newsletter, .block-advertisement").length === 0)
      .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 0);
    const body = allParagraphs.slice(0, BODY_PARAGRAPHS);
    const truncated = allParagraphs.length > BODY_PARAGRAPHS;
    if (!title || body.length === 0) return null;
    const pub = Number($('meta[name="pubdate"]').attr("content") ?? "");
    // Section (News, Exclusive…), industry (Information Technology…) and
    // market (Singapore…) labels shown above the article's headline.
    const node = $("article.node").first();
    const tags = Array.from(
      new Set(
        node
          .find('.nf-tc a, .nf-dc a, .node-published-info a[href*="/market/"]')
          .map((_, a) => $(a).text().replace(/\s+/g, " ").trim())
          .get()
          .filter((t) => t.length > 0),
      ),
    );
    const author = $(".nf-submitted-by").first().text().replace(/\s+/g, " ").trim();
    return {
      title,
      imageUrl: $('meta[property="og:image"]').attr("content") ?? null,
      // The generic house byline isn't worth showing; only named writers are.
      author: author && !/^staff reporter$/i.test(author) ? author : null,
      publishedAt: Number.isFinite(pub) && pub > 0 ? new Date(pub * 1000).toISOString() : null,
      body,
      tags,
      truncated,
    };
  } catch {
    return null;
  }
}

async function loadTopStories(): Promise<PeriodStories[]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var not set.");
  const creds = JSON.parse(raw) as { private_key: string; client_email: string };
  if (creds.private_key?.includes("\\n")) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  const client = new BetaAnalyticsDataClient({ credentials: creds });
  const brands = Object.keys(BRAND_DOMAINS);
  const articleCache = new Map<string, Promise<ArticleDetails | null>>();

  return Promise.all(
    PERIODS.map(async (period) => {
      const perBrand = await Promise.all(
        brands.map((b) => topPathsForBrand(client, b, period.startDate).catch(() => [])),
      );
      // Crossposts share a path across QSR domains — keep the biggest one.
      const byPath = new Map<string, Candidate>();
      for (const c of perBrand.flat()) {
        const cur = byPath.get(c.path);
        if (!cur || c.views > cur.views) byPath.set(c.path, c);
      }
      const ranked = Array.from(byPath.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, CANDIDATES);

      const enriched = await Promise.all(
        ranked.map(async (c) => {
          const url = `https://${BRAND_DOMAINS[c.brand]}${c.path}`;
          if (!articleCache.has(url)) articleCache.set(url, fetchArticle(url));
          const details = await articleCache.get(url)!;
          if (!details) return null;
          const meta = BRAND_PROPERTIES[c.brand];
          const story: Story = {
            ...details,
            url,
            views: c.views,
            brand: c.brand,
            brandName: meta?.name ?? c.brand,
            brandLogo: logoFor(meta?.image),
          };
          return story;
        }),
      );
      return {
        key: period.key,
        label: period.label,
        stories: enriched.filter((s): s is Story => s !== null).slice(0, TOP_N),
      };
    }),
  );
}

export default async function TopStoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ cache?: string; layout?: string }>;
}) {
  const params = await searchParams;
  const cache = getCache();
  const cacheKey = cacheKeys.editorialTopStories();
  if (params.cache === "clear") await cache.invalidate(cacheKey);

  let periods: PeriodStories[];
  try {
    periods = await cache.getOrLoad<PeriodStories[]>(cacheKey, loadTopStories, {
      ttlMs: ttls.TOP_STORIES,
      staleMs: ttls.TOP_STORIES_STALE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="rounded border border-red-400 bg-red-950 p-6 text-red-200 text-sm">{message}</div>
      </div>
    );
  }

  // The "Most read stories" list layout is the default; ?layout=carousel
  // shows the top 5 as cards under the headline instead.
  return <TopStoriesClient periods={periods} layout={params.layout === "carousel" ? "carousel" : "list"} />;
}
