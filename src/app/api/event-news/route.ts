import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const stripTrailingSlash = (u: string) => u.replace(/\/$/, "");

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface EventNewsItem {
  title: string;
  link?: string;
}

function parseEventNews(html: string, baseUrl: string): EventNewsItem[] {
  const items: EventNewsItem[] = [];
  const seen = new Set<string>();
  const h2Re =
    /<h2[^>]*class="[^"]*item__title[^"]*size-2[46][^"]*"[^>]*>([\s\S]*?)<\/h2>/g;
  let match: RegExpExecArray | null;
  while ((match = h2Re.exec(html)) !== null) {
    const inner = match[1];
    const aMatch = inner.match(
      /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    let rawTitle: string;
    let link: string | undefined;
    if (aMatch) {
      link = aMatch[1];
      rawTitle = aMatch[2];
    } else {
      rawTitle = inner;
    }
    const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, "").trim()).replace(
      /\s+/g,
      " ",
    );
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    if (link && link.startsWith("/")) link = baseUrl + link;
    items.push({ title, link });
  }
  return items;
}

function buildRss(channelLink: string, items: EventNewsItem[]) {
  const itemXml = items
    .map(
      (it) =>
        `<item><title>${escapeXml(it.title)}</title>${
          it.link ? `<link>${escapeXml(it.link)}</link>` : ""
        }</item>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Event News</title><link>${escapeXml(
    channelLink,
  )}</link><description>Event news</description>${itemXml}</channel></rss>`;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
  }
  const base = stripTrailingSlash(`${parsed.protocol}//${parsed.host}`);
  const target = `${base}/event-news`;

  let items: EventNewsItem[] = [];
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CMG-Dashboard/1.0; +https://charltonmediagroup.com)",
      },
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const html = await res.text();
      items = parseEventNews(html, base);
    }
  } catch {
    // fall through with empty items
  }

  return new NextResponse(buildRss(target, items), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
