import * as cheerio from "cheerio";

export interface AwardsBrand {
  brand: string;
  name: string;
  url: string;
}

export interface Award {
  id: string;
  brand: string;
  title: string;
  field_date: string;
  view_node: string;
  startDate?: string | null;
  endDate?: string | null;
  image?: string;
  city?: string | null;
  contactPerson?: string | null;
}

const KNOWN_LOCATIONS = [
  "Singapore", "Hong Kong", "Bangkok", "Manila", "Jakarta",
  "Kuala Lumpur", "Ho Chi Minh", "Hanoi", "Phnom Penh", "Yangon",
  "Taipei", "Seoul", "Tokyo", "Shanghai", "Beijing", "Shenzhen",
  "Mumbai", "New Delhi", "Dubai", "Sydney", "Melbourne",
  "Macau", "Cebu", "Davao", "Colombo", "Dhaka",
  "Malaysia", "Indonesia", "Thailand", "Philippines", "Vietnam",
  "Cambodia", "Myanmar", "India", "Sri Lanka", "Bangladesh",
  "Australia", "New Zealand", "Japan", "South Korea", "Taiwan",
  "China", "UAE", "Saudi Arabia", "Qatar", "Bahrain", "Oman", "Kuwait",
  "Greater Bay Area",
];

function normalizeTitle(str?: string) {
  if (!str) return "";
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getBestSrcFromSrcset(srcset?: string) {
  if (!srcset) return undefined;
  return srcset.split(",").map((s) => s.trim().split(" ")[0]).pop();
}

async function safeFetch(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed fetch: ${url} (${res.status})`);
  return res;
}

function matchLocation(text: string): string | null {
  const lower = text.toLowerCase();
  for (const loc of KNOWN_LOCATIONS) {
    const regex = new RegExp(`\\b${loc.toLowerCase()}\\b`);
    if (regex.test(lower)) return loc;
  }
  return null;
}

function detectCity(title: string, pageText?: string): string | null {
  if (pageText) {
    const patterns = [
      /(?:will be |is being )?held (?:at|in)\s+([^,.\n]{3,60})/i,
      /takes place (?:at|in)\s+([^,.\n]{3,60})/i,
      /ceremony (?:at|in)\s+([^,.\n]{3,60})/i,
      /awards night (?:at|in)\s+([^,.\n]{3,60})/i,
    ];
    for (const pat of patterns) {
      const m = pageText.match(pat);
      if (m) {
        const loc = matchLocation(m[1]);
        if (loc) return loc;
      }
    }
  }
  return matchLocation(title);
}

function detectContactPerson($: cheerio.CheerioAPI, pageText: string): string | null {
  const section = $("section.block-contact-data").first();
  if (section.length) {
    const name = section.find("strong").first().text().trim();
    if (name) return name;
  }
  const m = pageText.match(/For more details,\s*contact:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (m) return m[1].trim();
  return null;
}

const BATCH_SIZE = 5;

async function processInBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

async function fetchAwardImagesMap(siteUrl: string): Promise<Record<string, string>> {
  try {
    const html = await safeFetch(`${siteUrl}/awards`).then((r) => r.text());
    const $ = cheerio.load(html);
    const map: Record<string, string> = {};
    $(".view-content .item.with-border-bottom, .elementor-widget-image-box, .elementor-widget-image").each((_, el) => {
      const title =
        $(el).find(".item__title a, .elementor-image-box-title, a").first().text()?.trim() ||
        $(el).find("img").attr("alt") ||
        $(el).find("a").attr("title");
      if (!title) return;
      let img =
        getBestSrcFromSrcset($(el).find("img").attr("data-srcset")) ||
        getBestSrcFromSrcset($(el).find("img").attr("srcset")) ||
        $(el).find("img").attr("data-src") ||
        $(el).find("img").attr("data-lazy-src") ||
        $(el).find("img").attr("src");
      if (img && !img.startsWith("http")) img = new URL(img, siteUrl).href;
      if (img) map[normalizeTitle(title)] = img;
    });
    return map;
  } catch {
    return {};
  }
}

export async function getAwards(brands: AwardsBrand[]): Promise<Award[]> {
  const awardsRawArr = await Promise.all(
    brands.map(async (b) => {
      try {
        const res = await safeFetch(`${b.url}/node/content-menu/awards.json`);
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    }),
  );
  let awardsRaw = awardsRawArr.flat();

  awardsRaw = awardsRaw.map((a: Record<string, unknown>, idx: number) => {
    const viewNode = ((a.view_node as string) || "").toLowerCase();
    const brand = brands.find((b) => {
      const brandUrl = b.url.replace(/\/+$/, "").toLowerCase();
      return viewNode.startsWith(brandUrl);
    });
    return {
      ...a,
      id: (a.view_node as string) || `award-${idx}`,
      brand: brand?.brand || "unknown",
    };
  });

  const uniqueMap = new Map<string, Award>();
  for (const a of awardsRaw) {
    const title = a.title as string;
    const fieldDate = a.field_date as string;
    if (!title || !fieldDate) continue;
    const parsed = new Date(fieldDate);
    if (isNaN(parsed.getTime())) continue;
    const key = normalizeTitle(title) + "_" + parsed.toISOString().split("T")[0];
    if (!uniqueMap.has(key)) uniqueMap.set(key, a as Award);
  }

  const uniqueAwards = Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(a.field_date).getTime() - new Date(b.field_date).getTime(),
  );

  const [awardsWithDates, imageMapsArr] = await Promise.all([
    processInBatches(uniqueAwards, async (award) => {
      try {
        const html = await safeFetch(award.view_node).then((r) => r.text());
        const $ = cheerio.load(html);
        const pageText = $("body").text();
        return {
          ...award,
          startDate: $(".nomination-date .start-date").attr("date") || null,
          endDate: $(".nomination-date .end-date").attr("date") || null,
          city: detectCity(award.title, pageText),
          contactPerson: detectContactPerson($, pageText),
        } as Award;
      } catch {
        return {
          ...award,
          startDate: null,
          endDate: null,
          city: detectCity(award.title),
          contactPerson: null,
        } as Award;
      }
    }),
    Promise.all(brands.map((b) => fetchAwardImagesMap(b.url))),
  ]);

  const brandImageMaps: Record<string, Record<string, string>> = {};
  brands.forEach((b, i) => (brandImageMaps[b.brand] = imageMapsArr[i] || {}));

  return awardsWithDates.map((a) => {
    const brandMap = brandImageMaps[a.brand];
    if (!brandMap) return a;
    const normalized = normalizeTitle(a.title);
    for (const [scrapedTitle, img] of Object.entries(brandMap)) {
      if (scrapedTitle.includes(normalized) || normalized.includes(scrapedTitle)) {
        return { ...a, image: img };
      }
    }
    return a;
  });
}
