import * as cheerio from "cheerio";

export interface DrupalArticleSummary {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  imageUrl?: string;
}

function ensureUrl(href: string, origin: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return new URL(href, origin).toString();
  return href;
}

export async function fetchArticleSummary(
  domain: string,
  path = "/article_summary",
): Promise<DrupalArticleSummary[]> {
  const origin = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const url = `${origin}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "text/html" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Drupal fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const items: DrupalArticleSummary[] = [];
  $("article, .views-row, .node, .article-summary").each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find("h2 a, h3 a, .title a, a.title").first();
    const title = titleEl.text().trim();
    const href = titleEl.attr("href") ?? "";
    if (!title || !href) return;
    const author = $el.find(".author, .byline, .field--name-field-author").first().text().trim();
    const publishedAt = $el.find("time, .date").first().attr("datetime") ?? $el.find("time, .date").first().text().trim();
    const excerpt = $el.find(".excerpt, .summary, .teaser, p").first().text().trim();
    const imageUrl = $el.find("img").first().attr("src") ?? "";
    items.push({
      title,
      url: ensureUrl(href, origin),
      author: author || undefined,
      publishedAt: publishedAt || undefined,
      excerpt: excerpt || undefined,
      imageUrl: imageUrl ? ensureUrl(imageUrl, origin) : undefined,
    });
  });

  return items;
}
