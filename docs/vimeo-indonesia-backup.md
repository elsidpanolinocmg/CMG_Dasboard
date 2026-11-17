# Vimeo backup for Indonesia

Last updated: 17 Nov 2026

## The problem

Indonesian internet providers block Vimeo: the player (`player.vimeo.com`), and most likely the thumbnails (`i.vimeocdn.com`) too. The block has been in place since 2014.

- **Proof:** OONI network tests (Aug–Nov 2026) show Vimeo blocked for about 89% of Telkomsel tests, 75% of IndiHome/Telkom, 66% of Indosat, 63% of MyRepublic, 37% of Biznet and 31% of XL. First Media is rarely blocked, about 2%. A Samsung TV in an Indonesian office showed `ERR_CONNECTION_REFUSED … player.vimeo.com` on an ABR article.
- **Who is affected:** Indonesian readers of the CMG websites (~40k page views a month, about 1.2% of all traffic) and the Indonesian office TVs showing the dashboard. **The websites matter most, because they're public.**
- **Not affected:** the websites and dashboard themselves load fine. Only the Vimeo videos and thumbnails fail. Some connections, for example colleagues in Batam, aren't blocked at all.

## The solution in one sentence

We keep our own 720p copies of our Vimeo videos in Cloudflare and show them **only** to viewers in Indonesia, or to viewers who can't reach Vimeo. Everyone else keeps the normal Vimeo player, unchanged.

## How it works

```
Team uploads to Vimeo (no change)
        │
        ▼
Cloudflare Worker "cmg-video-fallback"  ── every 10 min: copy videos from the last 90 days (720p)
        │                                  ── on demand: copy an older video the first time it's asked for
        ▼
R2 bucket "cmg-video-backup"  (videos/<id>.mp4, captions/<id>.vtt)
        │
        ▼
video.charltonmedia.com
   /v/<id>.mp4          the video (seeking supported; also kept in the Cloudflare data centre
                        near the viewer, e.g. Jakarta, so it streams smoothly)
   /embed/<id>          player page that stands in for player.vimeo.com: shows the thumbnail,
                        downloads only when played, captions off by default (like Vimeo)
   /captions/<id>.vtt   captions
   /t/<path>            Vimeo thumbnails (i.vimeocdn.com) passed through
        ▲                                         ▲
        │                                         │
 WEBSITES (10 Drupal sites)                  DASHBOARD (Vercel)
 Cloudflare Snippet "cmg_vimeo_backup"       switches its players only if:
 runs only for visitors from Indonesia;      • country is on BACKUP_COUNTRIES (default ID), or
 swaps Vimeo players, pop-ups, lightbox      • player.vimeo.com can't be reached
 links and thumbnails on the page
```

**First play of a video that isn't backed up yet:** Cloudflare (outside Indonesia) streams it straight from Vimeo, so it starts in a few seconds, and saves a copy in the background. Every later play comes from the backup. Videos over ~150 MB are queued and copied by the next 10-minute check.

## Status

| Part | Status |
|---|---|
| Vimeo app + read-only token (`CMG R2 Video Fallback`) | ✅ Done |
| Cloudflare API token (`CMG R2 Video Fallback`) | ✅ Done |
| R2 bucket `cmg-video-backup` (Asia-Pacific) | ✅ Live, filling up |
| Worker `cmg-video-fallback` on `video.charltonmedia.com` | ✅ Live |
| **Websites:** Snippet on 10 sites | ✅ Live. ABR confirmed working from Indonesia. |
| **Dashboard** switch | ✅ Live. TV skipping fixed; smoothness fix (local copy in Jakarta) waiting for a re-test. |
| Article-page check on each site | ⏳ Next |
| Analytics (GA4 events for backup plays) | ⏳ Planned |
| Test on Telkomsel mobile data | ⏳ Planned |

### Websites with the fix

All are Drupal sites on Cloudflare's Pro plan (Snippets need Pro). Ordered by monthly page views from Indonesia:

| Site | Indonesian page views / month |
|---|---|
| asianbusinessreview.com (ABR) | ~21,900 |
| sbr.com.sg (SBR) | ~7,000 |
| asianbankingandfinance.net (ABF) | ~2,000 |
| retailasia.com | ~1,900 |
| healthcareasiamagazine.com | ~1,700 |
| asian-power.com | ~1,400 |
| insuranceasia.com | ~800 |
| realestateasia.com | ~600 |
| asiantelecom.com | ~400 |
| hongkongbusiness.hk (HKB) | ~300 |

**Not covered:** traveldailymedia.com (not Drupal, needs a different approach) and sites on Cloudflare's Free plan (Snippets not available). All have few Indonesian readers.

## Cost

| Item | Monthly |
|---|---|
| R2 storage: last 3 months of video (~117 videos, ~9 GB) plus the existing `cmgawards` bucket (~2.2 GB), with the first 10 GB free | ~$0.02 |
| Video delivery from R2 / Cloudflare cache | $0 |
| Snippets | $0 (included in the Pro plan, doesn't use Workers limits) |
| Workers: Free plan (100k requests/day for the whole account) | $0. Only Indonesian video traffic uses it. |
| **Total** | **~$0** |

**Amazee (Drupal hosting) traffic doesn't change:** pages are still served from Cloudflare's cache (`cf-cache-status: HIT`) for everyone, and the swap happens on the way to the Indonesian reader. Videos, thumbnails and the player never touch Amazee.

## Where things are

| What | Where |
|---|---|
| Worker source | `cloudflare/video-fallback/src/index.js` |
| Worker settings (bucket, schedule, 90-day window) | `cloudflare/video-fallback/wrangler.jsonc` |
| Website Snippet source | `cloudflare/abr-vimeo-swap/snippet.js` |
| Dashboard: decides when to switch | `src/lib/hooks/useVideoFallback.ts` |
| Dashboard: country check (Vercel geo header) | `src/app/api/video-fallback/route.ts` |
| Dashboard: backup stand-in for the Vimeo SDK | `src/lib/video/BackupPlayer.ts` |
| Dashboard players that switch | `EditorialVideosRotator.tsx`, `VideoRotatorXml.tsx`, `ShortsPlayer.tsx`, `VimeoEmbed.tsx` |
| Plan diagram | `reports/vimeo-indonesia-backup-plan.drawio` |
| Cloudflare: Worker, bucket | Account "Sbr@…'s Account" → Workers & Pages → `cmg-video-fallback`; R2 → `cmg-video-backup` |
| Cloudflare: Snippet on a site | that website → **Rules → Snippets** → `cmg_vimeo_backup` |

## Settings (in `.env.local` and Vercel; never commit the values)

| Name | Used by | Purpose |
|---|---|---|
| `VIMEO_BACKUP_TOKEN` | local scripts, and the Worker secret `VIMEO_TOKEN` | Vimeo token with Public, Private and Video Files scopes (read-only) |
| `CLOUDFLARE_API_TOKEN` | deploying the Worker and Snippets | Account: R2 Storage edit, Workers Scripts edit, Account Settings read. Zones (charltonmedia.com + the 10 sites): Zone read, Workers Routes edit, Snippets edit. No expiry. |
| `BACKUP_COUNTRIES` | dashboard (Vercel) | Countries that always get the backup, comma-separated ISO codes. Default `ID`. |
| `NEXT_PUBLIC_VIDEO_BACKUP_BASE` | dashboard | Backup address. Default `https://video.charltonmedia.com`. |

## How to…

### Test as if you were in Indonesia
- **Website:** add `?videoFallback=1` to any page, for example `https://sbr.com.sg/?videoFallback=1`. Nothing is remembered.
- **Dashboard:** add `?videoFallback=1` to any dashboard link. The browser **remembers** it. `?videoFallback=0` forces Vimeo, and `?videoFallback=clear` goes back to automatic.

To check it's the backup: right-click the video. A plain browser menu means backup. On websites, the player address starts with `video.charltonmedia.com`.

### Test from Indonesia
Ask someone on **Telkomsel mobile data** (Wi-Fi off) or **IndiHome** to compare:
- `https://player.vimeo.com/video/1247132601` (Vimeo, expected to fail),
- `https://video.charltonmedia.com/embed/1247132601` (backup, should play),
- any article with a video on one of the 10 sites.

### Add the fix to another website
1. Add the website to the Cloudflare API token's Zone policy (Zone read, Snippets edit).
2. Create the Snippet `cmg_vimeo_backup` on that site using `cloudflare/abr-vimeo-swap/snippet.js`, with the rule
   `(ip.src.country eq "ID") or (http.request.uri.query contains "videoFallback=1")`.
   This can be done via the API (as for the first 10 sites) or by pasting the code in Cloudflare → **Rules → Snippets**.
3. Check `https://<site>/?videoFallback=1`: no `player.vimeo.com` should be left on the page.

The site must be on the Pro plan or above.

### Add another country
- **Websites:** edit the Snippet rule on each site, for example `ip.src.country in {"ID" "VN"}`.
- **Dashboard:** change `BACKUP_COUNTRIES` in Vercel (for example `ID,VN`) and redeploy.

### Change how far back videos are copied
Edit `PRECOPY_DAYS` in `cloudflare/video-fallback/wrangler.jsonc` (currently `90`) and redeploy the Worker. Older videos are still copied on demand.

### Redeploy the Worker
From `cloudflare/video-fallback/`, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set in the shell:
```
npx wrangler deploy
```
To change the Vimeo secret, pass the token **without** a PowerShell pipe (PowerShell adds an invisible character that breaks it), for example via Node's `execSync` with `input`, or run `npx wrangler secret put VIMEO_TOKEN` and paste the token when asked.

### Check that it's working
- `https://video.charltonmedia.com/health` should say `cmg-video-fallback ok`.
- Cloudflare → R2 → `cmg-video-backup` → `videos/` should keep growing as new videos are uploaded.
- Cloudflare → Workers & Pages → `cmg-video-fallback` → **Logs** shows each request with country and internet provider, plus `copied <id> …` lines.
- `npx wrangler tail --format json` (in the Worker folder) streams the same log live.

### Switch it off
- **One website:** that site → **Rules → Snippets** → disable `cmg_vimeo_backup`. The site goes back to normal straight away.
- **Everything:** Workers & Pages → `cmg-video-fallback` → Settings → Domains & Routes → remove `video.charltonmedia.com`.
- **Dashboard only:** set `BACKUP_COUNTRIES` to an empty value. Viewers who can't reach Vimeo would still switch; to stop that too, revert the dashboard commits.

## Lessons from testing
- **Dashboard TVs skipped videos every ~2 seconds** (black → frame → black). The TV-mode stuck-video checks (2–2.5 s) fired before the plain 720p file had started. Backup videos now get up to 15 s to start, and the current video stays on screen until the next one plays.
- **Choppy playback on a TV** (Biznet): the TV browser fetches video in ~1-second pieces, and each piece came from R2 with a delay. Videos are now also kept in the Cloudflare data centre near the viewer.
- **Asian Telecom** opens videos in a lightbox (fancybox) from `<a href="player.vimeo.com/…">` links. The Snippet swaps those and tells the lightbox to open them as an embedded page.

## Known limits
- **China** isn't covered reliably; it would need a China-based video host.
- **Videos from other Vimeo accounts** (for example sponsors embedding their own) can't be backed up. Only videos in the Charlton Media Group Vimeo account are.
- **Backup plays don't show in Vimeo's play counts.** The planned GA4 events will fill this gap.
- **The backup plays at a fixed 720p.** It doesn't adjust quality automatically on slow connections the way Vimeo does.
- **TDM and Free-plan sites** aren't covered.
