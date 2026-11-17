// Cloudflare Snippet: cmg_vimeo_backup  (zone: asianbusinessreview.com)
//
// Vimeo (player.vimeo.com, i.vimeocdn.com) is blocked by ISPs in Indonesia.
// For visitors matched by the snippet rule (Indonesia), this swaps Vimeo
// players and thumbnails on HTML pages for our backup on video.charltonmedia.com.
// Everyone else never runs this. The page itself still comes from Cloudflare's
// cache as before, so Amazee traffic doesn't change.
//
// Snippet rule (expression):
//   (ip.src.country eq "ID") or (http.request.uri.query contains "videoFallback=1")
// The second part lets us test from outside Indonesia by adding ?videoFallback=1.
//
// To switch off: disable or delete the snippet in Cloudflare (Rules > Snippets).

const BACKUP = "https://video.charltonmedia.com";

// https://player.vimeo.com/video/123?x=1  ->  https://video.charltonmedia.com/embed/123?x=1
function toEmbed(value) {
  const m = /^(?:https?:)?\/\/player\.vimeo\.com\/video\/(\d+)([?#].*)?$/.exec(value || "");
  return m ? `${BACKUP}/embed/${m[1]}${m[2] || ""}` : null;
}

// https://i.vimeocdn.com/video/abc-d_640?region=us  ->  https://video.charltonmedia.com/t/video/abc-d_640?region=us
function toThumb(value) {
  const m = /^(?:https?:)?\/\/i\.vimeocdn\.com\/(video\/[^"'\s]+)$/.exec(value || "");
  return m ? `${BACKUP}/t/${m[1]}` : null;
}

class Swap {
  constructor(attr, fn, extra) {
    this.attr = attr;
    this.fn = fn;
    this.extra = extra; // extra attributes to set when swapped
  }
  element(el) {
    const next = this.fn(el.getAttribute(this.attr));
    if (!next) return;
    el.setAttribute(this.attr, next);
    for (const [k, v] of Object.entries(this.extra || {})) el.setAttribute(k, v);
  }
}

export default {
  async fetch(request) {
    const response = await fetch(request);
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("text/html")) return response;

    return new HTMLRewriter()
      // Article video (lazy-loaded: the real address is in data-src)
      .on('iframe[src*="player.vimeo.com/video/"]', new Swap("src", toEmbed))
      .on('iframe[data-src*="player.vimeo.com/video/"]', new Swap("data-src", toEmbed))
      // "More videos" pop-ups
      .on('[vid-url*="player.vimeo.com/video/"]', new Swap("vid-url", toEmbed))
      // Lightbox links (fancybox, e.g. Asian Telecom). Fancybox recognises Vimeo
      // links by their address; ours it must be told to open as an embedded page.
      .on('a[href*="player.vimeo.com/video/"]', new Swap("href", toEmbed, { "data-type": "iframe" }))
      // Thumbnails
      .on('img[src*="i.vimeocdn.com/video/"]', new Swap("src", toThumb))
      .on('img[data-src*="i.vimeocdn.com/video/"]', new Swap("data-src", toThumb))
      .transform(response);
  },
};
