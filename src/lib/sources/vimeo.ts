export interface VimeoVideo {
  id: string;
  title: string;
  description: string;
  uri: string;
  duration: number;
  thumbnail: string;
  embedHtml: string;
  createdTime: string;
  link: string;
  tags: string[];
  width: number;
  height: number;
  plays: number;
  privacy: string;
  language: string | null;
}

interface VimeoApiPicture {
  sizes: { width: number; height: number; link: string }[];
}

interface VimeoApiVideo {
  uri: string;
  name: string;
  description: string | null;
  duration: number;
  created_time: string;
  link: string;
  embed: { html: string };
  pictures: VimeoApiPicture;
  tags: { name: string }[];
  width: number;
  height: number;
  stats?: { plays: number | null };
  privacy?: { view: string };
  language: string | null;
}

const VIMEO_API = "https://api.vimeo.com";

function getAccessToken(): string {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) throw new Error("VIMEO_ACCESS_TOKEN not set");
  return token;
}

function extractId(uri: string): string {
  return uri.replace("/videos/", "");
}

function pickThumbnail(pictures: VimeoApiPicture): string {
  const sorted = [...pictures.sizes].sort((a, b) => b.width - a.width);
  return sorted[0]?.link || "";
}

function mapVideo(v: VimeoApiVideo): VimeoVideo {
  return {
    id: extractId(v.uri),
    title: v.name,
    description: v.description || "",
    uri: v.uri,
    duration: v.duration,
    thumbnail: pickThumbnail(v.pictures),
    embedHtml: v.embed.html,
    createdTime: v.created_time,
    link: v.link,
    tags: v.tags.map((t) => t.name.toLowerCase()),
    width: v.width,
    height: v.height,
    plays: v.stats?.plays ?? 0,
    privacy: v.privacy?.view ?? "unknown",
    language: v.language,
  };
}

export async function fetchVimeoVideos(tag?: string, maxVideos = 300): Promise<VimeoVideo[]> {
  const token = getAccessToken();
  const perPage = 100;
  const fields =
    "uri,name,description,duration,created_time,link,embed.html,pictures.sizes,tags.name,width,height,stats.plays,privacy.view,language";

  const all: VimeoApiVideo[] = [];
  let page = 1;

  while (all.length < maxVideos) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort: "date",
      direction: "desc",
      fields,
    });
    if (tag) params.set("query", tag);

    const res = await fetch(`${VIMEO_API}/me/videos?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Vimeo API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const batch: VimeoApiVideo[] = json.data || [];
    all.push(...batch);

    const total: number = json.total ?? 0;
    if (batch.length < perPage || all.length >= total) break;
    page++;
  }

  return all.slice(0, maxVideos).map(mapVideo);
}

export async function fetchVimeoVideosByBrand(brandTag: string, maxVideos = 300): Promise<VimeoVideo[]> {
  return fetchVimeoVideos(brandTag, maxVideos);
}
