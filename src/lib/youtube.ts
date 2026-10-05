const ID_PATTERNS = [
  /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/(?:shorts|live)\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
];

/**
 * Pulls the 11-character video id out of anything an admin might paste: a
 * watch link, a youtu.be share link, a Shorts link, an embed URL or the whole
 * `<iframe>` embed code. Null when no id is found.
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  for (const re of ID_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

/** The stored form of a YouTube custom page's mediaPath. */
export function youTubeEmbedBase(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}

/**
 * Embed URL for a wall screen: autoplays muted (browsers block sound on
 * autoplay), hides related videos, and plays `ids` in order on a loop.
 * `subtitles` forces YouTube's subtitles on.
 * `controls` keeps YouTube's own bar so viewers can unmute.
 */
export function youTubePlayerUrl(
  ids: string[],
  opts: { controls?: boolean; subtitles?: boolean } = {},
): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: ids.join(","),
    rel: "0",
    playsinline: "1",
    controls: opts.controls ? "1" : "0",
    cc_load_policy: opts.subtitles ? "1" : "0",
    cc_lang_pref: "en",
  });
  return `${youTubeEmbedBase(ids[0] ?? "")}?${params}`;
}

export function youTubeThumbnail(mediaPath: string): string {
  return `https://i.ytimg.com/vi/${parseYouTubeId(mediaPath) ?? ""}/hqdefault.jpg`;
}

export function youTubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}
