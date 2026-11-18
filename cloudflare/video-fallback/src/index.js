// Cloudflare Worker: cmg-video-fallback  (video.charltonmedia.com)
//
// Vimeo (player.vimeo.com) is blocked by ISPs in some countries, e.g. Indonesia.
// This Worker keeps copies of our own Vimeo videos in R2 and plays them
// for viewers who can't reach Vimeo. Everyone else never touches it.
// Two sizes: 720p (websites, the default) and 540p (dashboard TVs: ~35% smaller,
// lighter to download and decode on TV browsers). Pick one with ?q=540.
//
//   GET /v/<vimeoId>.mp4        the video (?q=540 for the small copy). From R2 if copied; otherwise streamed
//                                straight from Vimeo (Cloudflare can reach it) and
//                                copied to R2 in the background ("copy on demand").
//   GET /embed/<vimeoId>        a small player page that stands in for
//                                player.vimeo.com/video/<id>. Options (query):
//                                autoplay, muted, loop, controls, background, player_id, q
//   GET /captions/<vimeoId>.vtt captions (WebVTT) for the video, if it has any.
//   cron every 10 minutes       copies videos uploaded in the last PRECOPY_DAYS days,
//                                in each size listed in PRECOPY_QUALITIES.
//
// Read-only on Vimeo: the token can read and download, not change or delete.
// To switch off: remove the custom domain / disable the Worker. Nothing else depends on it.

const VIMEO_API = "https://api.vimeo.com";
// Sizes we keep. 720 = the original copies (keys without a size suffix, unchanged).
const QUALITIES = ["720", "540"];
const quality = (url) => (QUALITIES.includes(url.searchParams.get("q")) ? url.searchParams.get("q") : "720");
const sfx = (q) => (q === "720" ? "" : `-${q}`);
const VIDEO_KEY = (id, q = "720") => `videos${sfx(q)}/${id}.mp4`;
const CAPTION_KEY = (id) => `captions/${id}.vtt`;
// Older videos asked for, waiting for the 10-minute check.
const PENDING_KEY = (id, q = "720") => `pending${sfx(q)}/${id}`;
const ON_DEMAND_MAX_BYTES = 150e6;
const LINK_TTL = 1800; // seconds a Vimeo file link is reused before asking Vimeo again
const LOCK_TTL = 300; // seconds a copy is marked "in progress" so viewers don't start duplicates

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "content-length, content-range, accept-ranges",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, "access-control-allow-headers": "range" } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    let m;
    if ((m = url.pathname.match(/^\/v\/(\d+)\.mp4$/))) return serveVideo(m[1], quality(url), request, env, ctx);
    if ((m = url.pathname.match(/^\/embed\/(\d+)\/?$/))) return embedPage(m[1], url, env);
    if ((m = url.pathname.match(/^\/captions\/(\d+)\.vtt$/))) return serveCaptions(m[1], env, ctx);
    if (url.pathname.startsWith("/t/")) return serveThumb(url, request, ctx);
    if (url.pathname === "/tvtest") return tvTestPage(url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("cmg-video-fallback ok", { headers: { "content-type": "text/plain" } });
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(precopyRecent(env));
  },
};

/* ---------------- video ---------------- */

async function serveVideo(id, q, request, env, ctx) {
  const key = VIDEO_KEY(id, q);
  const rangeHeader = request.headers.get("range");

  // 0) Fastest: a copy in the Cloudflare data centre near the viewer (e.g. Jakarta).
  //    TV browsers fetch video in many small pieces; each piece from R2 has a
  //    noticeable delay, which made playback stutter. From the edge cache it's instant.
  const edgeKey = edgeCacheKey(id, q);
  const cached = await caches.default.match(
    new Request(edgeKey.url, { headers: rangeHeader ? { range: rangeHeader } : {} }),
  );
  if (cached) {
    const headers = new Headers(cached.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    headers.set("x-backup-source", "edge");
    return new Response(request.method === "HEAD" ? null : cached.body, { status: cached.status, headers });
  }

  // 1) Backed up: serve from R2, honouring Range so players can seek and stream,
  //    and fill the edge cache in the background for the next pieces / viewers.
  const range = parseRange(rangeHeader);
  const obj = await env.BUCKET.get(key, range ? { range } : {});
  if (obj) {
    if (obj.size <= EDGE_CACHE_MAX_BYTES) ctx.waitUntil(fillEdgeCache(id, q, env));
    return r2Response(obj, request, range);
  }

  // 2) Not yet: stream it from Vimeo now, and copy it to R2 in the background.
  const file = await vimeoFile(id, env, q);
  if (!file) return new Response("Video not found", { status: 404, headers: CORS });

  // Background work only gets ~30 s after the response, enough for a typical
  // video. Bigger ones are queued for the 10-minute check, which has more time.
  if (file.size <= ON_DEMAND_MAX_BYTES) ctx.waitUntil(copyOnce(id, file, env, q));
  else ctx.waitUntil(env.BUCKET.put(PENDING_KEY(id, q), "1"));

  const upstreamHeaders = {};
  if (rangeHeader) upstreamHeaders.range = rangeHeader;
  const upstream = await fetch(file.link, { headers: upstreamHeaders });
  const headers = new Headers(CORS);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  headers.set("cache-control", "no-store");
  headers.set("x-backup-source", "vimeo-live");
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

const EDGE_CACHE_MAX_BYTES = 450e6; // Cloudflare's cache takes files up to 512 MB
const edgeCacheKey = (id, q) => new Request(`https://video.charltonmedia.com/__edge/v${sfx(q)}/${id}.mp4`);

// Put the whole file into this data centre's cache (once; a short lock stops
// the many small requests of one TV from each starting their own copy).
async function fillEdgeCache(id, q, env) {
  const cache = caches.default;
  const lockKey = new Request(`https://cmg-video-fallback.internal/edge-lock${sfx(q)}/${id}`);
  if (await cache.match(lockKey)) return;
  await cache.put(lockKey, new Response("1", { headers: { "cache-control": "max-age=120" } }));
  try {
    const full = await env.BUCKET.get(VIDEO_KEY(id, q));
    if (!full) return;
    const headers = new Headers({
      "content-type": "video/mp4",
      "content-length": String(full.size),
      "accept-ranges": "bytes",
      etag: full.httpEtag,
      "cache-control": "public, max-age=604800",
    });
    await cache.put(edgeCacheKey(id, q), new Response(full.body, { headers }));
  } catch (err) {
    console.log(`edge cache fill failed ${id}: ${err.message}`);
    await cache.delete(lockKey);
  }
}

// "bytes=START-END", "bytes=START-" or "bytes=-SUFFIX" -> an R2 range; anything else -> whole file.
function parseRange(h) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((h || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  return m[2] === "" ? { offset } : { offset, length: Number(m[2]) - offset + 1 };
}

function r2Response(obj, request, range) {
  const headers = new Headers(CORS);
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=86400");
  headers.set("x-backup-source", "r2");
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");

  let status = 200;
  if (range) {
    let offset, length;
    if ("suffix" in range) {
      length = Math.min(range.suffix, obj.size);
      offset = obj.size - length;
    } else {
      offset = range.offset;
      length = Math.min(range.length ?? obj.size - offset, obj.size - offset);
    }
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    status = 206;
  } else {
    headers.set("content-length", String(obj.size));
  }
  return new Response(request.method === "HEAD" ? null : obj.body, { status, headers });
}

// The MP4 of size q (720p / 540p, or the nearest if missing). Links expire,
// so they're fetched fresh, but reused for LINK_TTL to go easy on Vimeo's API limits.
async function vimeoFile(id, env, q = "720") {
  const cache = caches.default;
  const cacheKey = new Request(`https://cmg-video-fallback.internal/link${sfx(q)}/${id}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit.json();

  const res = await fetch(`${VIMEO_API}/videos/${id}?fields=name,created_time,duration,files,pictures.sizes`, {
    headers: vimeoHeaders(env),
  });
  if (!res.ok) {
    console.log(`vimeo video ${id}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  const v = await res.json();
  const file = pickFile(v.files || [], q);
  if (!file) return null;

  const out = {
    link: file.link,
    size: file.size,
    rendition: file.rendition,
    name: v.name || "",
    created: v.created_time || "",
    poster: pickPoster(v.pictures),
  };
  await cache.put(
    cacheKey,
    new Response(JSON.stringify(out), {
      headers: { "content-type": "application/json", "cache-control": `max-age=${LINK_TTL}` },
    }),
  );
  return out;
}

// Thumbnail around 960 px wide, served through our /t/ proxy (i.vimeocdn.com is blocked too).
function pickPoster(pictures) {
  const sizes = (pictures && pictures.sizes) || [];
  if (!sizes.length) return "";
  const best = sizes.filter((s) => s.width <= 1280).sort((a, b) => b.width - a.width)[0] || sizes[0];
  const m = /^https:\/\/i\.vimeocdn\.com\/(video\/[^?#]+)(\?[^#]*)?/.exec(best.link || "");
  return m ? `/t/${m[1]}${m[2] || ""}` : "";
}

function pickFile(files, q = "720") {
  const mp4 = files.filter((f) => f.type === "video/mp4" && f.link && f.size);
  if (!mp4.length) return null;
  const exact = mp4.find((f) => f.rendition === `${q}p`);
  if (exact) return exact;
  // Shorts / unusual sizes: largest file whose short side is at most q, else the smallest.
  const short = (f) => Math.min(f.width || 0, f.height || 0);
  const ok = mp4.filter((f) => short(f) <= Number(q)).sort((a, b) => short(b) - short(a));
  return ok[0] || mp4.sort((a, b) => a.size - b.size)[0];
}

// Copy one video to R2 unless it's there already or another request is copying it.
async function copyOnce(id, file, env, q = "720") {
  const cache = caches.default;
  const lockKey = new Request(`https://cmg-video-fallback.internal/lock${sfx(q)}/${id}`);
  if (await cache.match(lockKey)) return false;
  await cache.put(lockKey, new Response("1", { headers: { "cache-control": `max-age=${LOCK_TTL}` } }));
  try {
    if (await env.BUCKET.head(VIDEO_KEY(id, q))) return false;
    const res = await fetch(file.link);
    if (!res.ok || !res.body) throw new Error(`download ${id}: ${res.status}`);
    await env.BUCKET.put(VIDEO_KEY(id, q), res.body, {
      httpMetadata: { contentType: "video/mp4" },
      customMetadata: { title: file.name.slice(0, 200), created: file.created, rendition: file.rendition || "" },
    });
    // Captions too, so the backup player has them without asking Vimeo later.
    await fetchCaptions(id, env).catch(() => {});
    await env.BUCKET.delete(PENDING_KEY(id, q));
    console.log(`copied ${id} (${file.rendition}, ${Math.round(file.size / 1e6)} MB)`);
    return true;
  } catch (err) {
    console.log(`copy failed ${id}: ${err.message}`);
    // Try again on the next 10-minute check.
    await env.BUCKET.put(PENDING_KEY(id, q), "1").catch(() => {});
    return false;
  } finally {
    await cache.delete(lockKey);
  }
}

/* ---------------- 10-minute check ---------------- */

async function precopyRecent(env) {
  // 720p first (websites), then the smaller dashboard copies.
  const qs = String(env.PRECOPY_QUALITIES || "720,540")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => QUALITIES.includes(x));
  for (const q of qs) await precopyQuality(env, q);
}

async function precopyQuality(env, q) {
  // Each size can have its own window (PRECOPY_DAYS_540), else PRECOPY_DAYS.
  const days = Number(env[`PRECOPY_DAYS_${q}`] || env.PRECOPY_DAYS || 90);
  const perRun = Number(env.COPIES_PER_RUN || 4);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  let copied = 0;

  // First, older videos viewers asked for that were too big (or failed) to copy on the spot.
  const pending = await env.BUCKET.list({ prefix: `pending${sfx(q)}/`, limit: perRun });
  for (const p of pending.objects) {
    const id = p.key.split("/").pop();
    if (await env.BUCKET.head(VIDEO_KEY(id, q))) {
      await env.BUCKET.delete(p.key);
      continue;
    }
    const f = await vimeoFile(id, env, q);
    if (!f) {
      await env.BUCKET.delete(p.key); // gone from Vimeo
      continue;
    }
    if ((await copyOnce(id, f, env, q)) && ++copied >= perRun) return;
  }

  for (let page = 1; page <= 10 && copied < perRun; page++) {
    const res = await fetch(
      `${VIMEO_API}/me/videos?per_page=50&page=${page}&sort=date&direction=desc&fields=uri,name,created_time,files`,
      { headers: vimeoHeaders(env) },
    );
    if (!res.ok) {
      console.log(`vimeo list failed: ${res.status}`);
      return;
    }
    const j = await res.json();
    for (const v of j.data || []) {
      if (v.created_time < since) return; // newest first: everything after this is older
      const id = v.uri.split("/").pop();
      if (await env.BUCKET.head(VIDEO_KEY(id, q))) continue;
      const f = pickFile(v.files || [], q);
      if (!f) continue; // still processing on Vimeo; next run picks it up
      const ok = await copyOnce(
        id,
        { link: f.link, size: f.size, rendition: f.rendition, name: v.name || "", created: v.created_time },
        env,
        q,
      );
      if (ok && ++copied >= perRun) return;
    }
    if (!j.paging || !j.paging.next) return;
  }
}

/* ---------------- captions ---------------- */

async function serveCaptions(id, env, ctx) {
  let vtt = await env.BUCKET.get(CAPTION_KEY(id));
  let text = vtt ? await vtt.text() : null;
  if (text === null) {
    text = await fetchCaptions(id, env).catch(() => null);
  }
  if (!text) return new Response("WEBVTT\n\n", { headers: { ...CORS, "content-type": "text/vtt" } });
  return new Response(text, {
    headers: { ...CORS, "content-type": "text/vtt; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

// Same choice as the dashboard's /api/vimeo-captions: active track first, then English, then any.
async function fetchCaptions(id, env) {
  const res = await fetch(`${VIMEO_API}/videos/${id}/texttracks`, { headers: vimeoHeaders(env) });
  if (!res.ok) return null;
  const tracks = (await res.json()).data || [];
  const t =
    tracks.find((x) => x.active && x.link) ||
    tracks.find((x) => x.link && /^en/i.test(x.language || "")) ||
    tracks.find((x) => x.link);
  if (!t) return null;
  const vtt = await fetch(t.link);
  if (!vtt.ok) return null;
  const text = await vtt.text();
  await env.BUCKET.put(CAPTION_KEY(id), text, { httpMetadata: { contentType: "text/vtt" } });
  return text;
}

function vimeoHeaders(env) {
  return {
    // Strip a stray byte-order mark / whitespace some shells add when setting the secret.
    Authorization: `Bearer ${String(env.VIMEO_TOKEN || "").replace(/^﻿/, "").trim()}`,
    Accept: "application/vnd.vimeo.*+json;version=3.4",
  };
}

/* ---------------- thumbnails ---------------- */

// /t/<path>?<query>  ->  https://i.vimeocdn.com/<path>?<query>
// Vimeo thumbnails (i.vimeocdn.com) for pages shown to blocked viewers.
// Only that one host is ever fetched, and results are cached at the edge.
async function serveThumb(url, request, ctx) {
  const path = url.pathname.slice(3);
  if (!/^video\/[\w.-]+$/.test(path)) return new Response("Not found", { status: 404 });
  const upstream = `https://i.vimeocdn.com/${path}${url.search}`;
  const cache = caches.default;
  const cacheKey = new Request(upstream);
  let res = await cache.match(cacheKey);
  if (!res) {
    const r = await fetch(upstream);
    if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) {
      return new Response("Not found", { status: 404 });
    }
    res = new Response(r.body, r);
    res.headers.set("cache-control", "public, max-age=604800");
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  const out = new Response(res.body, res);
  out.headers.set("access-control-allow-origin", "*");
  return out;
}

/* ---------------- player page ---------------- */

function flag(url, name, dflt) {
  const v = url.searchParams.get(name);
  if (v === null) return dflt;
  return v === "1" || v === "true";
}

async function embedPage(id, url, env) {
  const background = flag(url, "background", false);
  const autoplay = flag(url, "autoplay", background);
  const muted = flag(url, "muted", background || autoplay);
  const loop = flag(url, "loop", background);
  const controls = flag(url, "controls", !background);
  const q = quality(url);
  const playerId = (url.searchParams.get("player_id") || "").replace(/[^\w-]/g, "").slice(0, 64);

  // Like Vimeo: show the thumbnail, and only download the video when it plays
  // (saves mobile data for readers who never press play).
  let poster = "";
  if (!autoplay) {
    const info = await vimeoFile(id, env).catch(() => null);
    poster = (info && info.poster) || "";
  }

  const attrs = [
    "playsinline",
    autoplay ? "preload=\"auto\"" : "preload=\"none\"",
    poster ? `poster="${poster.replace(/"/g, "&quot;")}"` : "",
    autoplay ? "autoplay" : "",
    muted ? "muted" : "",
    loop ? "loop" : "",
    controls ? "controls" : "",
  ].filter(Boolean).join(" ");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Video</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;display:block;object-fit:contain;background:#000}</style>
</head><body>
<video id="v" ${attrs} src="/v/${id}.mp4${q === "720" ? "" : `?q=${q}`}" crossorigin="anonymous">
<track kind="captions" srclang="en" label="Captions" src="/captions/${id}.vtt">
</video>
<script>
(function(){
  var v=document.getElementById("v"), pid=${JSON.stringify(playerId)};
  function post(event,data){
    try{ parent.postMessage(JSON.stringify({event:event,player_id:pid,data:data||{}}),"*"); }catch(e){}
  }
  v.addEventListener("ended",function(){ post("ended"); });
  v.addEventListener("playing",function(){ post("play"); });
  ${autoplay ? 'var p=v.play(); if(p&&p.catch)p.catch(function(){ v.muted=true; v.play().catch(function(){}); });' : ""}
})();
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

/* ---------------- TV test page ---------------- */

// /tvtest?id=<vimeoId>&ticker=1&cap=1&two=1
// Plays one backup video the way the dashboard does, adding the dashboard's
// extras one at a time, to find which one makes a TV browser stutter:
//   ticker = scrolling news strip underneath, cap = caption box redrawn 4x a second,
//   two = a second (paused) video layered underneath, like the rotator's "next" video.
function tvTestPage(url) {
  const id = (url.searchParams.get("id") || "1247864459").replace(/\D/g, "");
  const on = (k) => url.searchParams.get(k) === "1";
  const ticker = on("ticker"), cap = on("cap"), two = on("two");
  const label = ["video", ticker && "ticker", cap && "captions", two && "2nd video"].filter(Boolean).join(" + ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>TV test: ${label}</title>
<style>html,body{margin:0;height:100%;background:#fff;font-family:sans-serif;overflow:hidden}
.wrap{display:flex;flex-direction:column;height:100%}.area{position:relative;flex:1;background:#000}
.layer{position:absolute;inset:0;transition:opacity 1s}video{width:100%;height:100%;object-fit:contain;background:#000}
.cap{position:absolute;bottom:20%;left:50%;transform:translateX(-50%);z-index:10;color:#fff;background:rgba(0,0,0,.72);padding:4px 14px;font-size:3vw}
.tk{height:60px;overflow:hidden;white-space:nowrap;background:#111;color:#fff;font-size:28px;line-height:60px}
.tk span{display:inline-block;animation:sc 40s linear infinite}@keyframes sc{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
.lbl{position:absolute;top:8px;left:8px;z-index:20;color:#ff0;font-size:22px;background:rgba(0,0,0,.5);padding:4px 8px}</style></head>
<body><div class="wrap"><div class="area"><div class="lbl">${label}</div>
${two ? `<div class="layer" style="opacity:0"><video preload="metadata" muted playsinline src="/v/${id}.mp4"></video></div>` : ""}
<div class="layer" style="z-index:1"><video autoplay muted loop playsinline preload="auto" src="/v/${id}.mp4"></video></div>
${cap ? '<div class="cap" id="c"></div>' : ""}</div>
${ticker ? '<div class="tk"><span>' + "Breaking: Asian Business Review headline scrolling across the screen &nbsp;&bull;&nbsp; ".repeat(6) + "</span></div>" : ""}
</div>${cap ? '<script>var n=0,c=document.getElementById("c");setInterval(function(){c.textContent="Caption line "+(Math.floor(n++/12));},250);</script>' : ""}
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
