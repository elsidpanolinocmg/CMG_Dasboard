# Vimeo backup for Indonesia

Last updated: 17 Nov 2026

## The problem

Indonesian internet providers block Vimeo, including `player.vimeo.com`, the address every embedded Vimeo player loads from. The block has been in place since 2014.

- **Proof:** OONI network tests (Aug–Nov 2026) show Vimeo blocked for about 89% of Telkomsel tests, 75% of IndiHome tests and 66% of Indosat tests. A Samsung TV in the Indonesian office shows `ERR_CONNECTION_REFUSED … player.vimeo.com` on an ABR article.
- **Who is affected:** Indonesian viewers of the dashboard (office TVs) and of the CMG websites. Indonesia is about 1.2% of website page views (~40k a month); ABR alone is ~22k of those.
- **Not affected:** the dashboard and websites themselves. Only the video players fail.

## The solution in one sentence

We keep our own 720p copies of our Vimeo videos in Cloudflare R2 and play them **only** for viewers who can't reach Vimeo. Everyone else keeps the normal Vimeo player, unchanged.

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
video.charltonmedia.com  ── /v/<id>.mp4        the video file (seeking supported)
                         ── /embed/<id>         a player page that stands in for player.vimeo.com
                         ── /captions/<id>.vtt  captions
        ▲                          ▲
        │                          │
   Dashboard (Vercel)         Websites (ABR, via Cloudflare) — not built yet
   switches only if:          will switch only for Indonesian readers
   • country is on the list
     (BACKUP_COUNTRIES, default ID), or
   • player.vimeo.com can't be reached
```

**Who gets the backup:** viewers in a country on the backup list, or anyone whose browser can't reach Vimeo, for example on an office network that blocks it. Everyone else gets Vimeo as before, with no delay.

**First play of a video that isn't backed up yet:** Cloudflare (outside Indonesia) streams it straight from Vimeo, so it starts in a few seconds, and saves a copy in the background. Every later play comes from R2 and starts in under a second. Videos over ~150 MB are queued and copied by the next 10-minute check.

## Status

| Part | Status |
|---|---|
| Vimeo app + read-only token (`CMG R2 Video Fallback`) | ✅ Done |
| Cloudflare API token (`CMG R2 Video Fallback`) | ✅ Done |
| R2 bucket `cmg-video-backup` (Asia-Pacific) | ✅ Done, filling up |
| Worker `cmg-video-fallback` + `video.charltonmedia.com` | ✅ Live and tested |
| Dashboard switch | ✅ Works locally, ⏳ not pushed to the live dashboard yet |
| ABR website swap (Cloudflare Snippet or Worker) | ⏳ Next |
| Analytics (GA4 events + backup play counter) | ⏳ Planned |
| Test in Indonesia (office TV + Telkomsel phone) | ⏳ Planned |

## Cost

| Item | Monthly |
|---|---|
| R2 storage: last 3 months of video (~117 videos, ~9 GB) plus the existing `cmgawards` bucket (~2.2 GB), with the first 10 GB free | ~$0.02 |
| Video delivery from R2 | $0 (R2 doesn't charge for data sent out) |
| Workers: Free plan (100k requests/day for the whole account) | $0. Upgrade to Paid ($5) only if the website swap outgrows it. |
| **Total** | **~$0–5** |

Amazee (Drupal hosting) traffic doesn't change: videos and the player page never touch Amazee, and article pages stay cached by Cloudflare.

## Where things are

| What | Where |
|---|---|
| Worker source | `cloudflare/video-fallback/src/index.js` |
| Worker settings (bucket, schedule, 90-day window) | `cloudflare/video-fallback/wrangler.jsonc` |
| Dashboard: decides when to switch | `src/lib/hooks/useVideoFallback.ts` |
| Dashboard: country check (Vercel geo header) | `src/app/api/video-fallback/route.ts` |
| Dashboard: backup stand-in for the Vimeo SDK | `src/lib/video/BackupPlayer.ts` |
| Dashboard players that switch | `EditorialVideosRotator.tsx`, `VideoRotatorXml.tsx`, `ShortsPlayer.tsx`, `VimeoEmbed.tsx` |
| Plan diagram | `reports/vimeo-indonesia-backup-plan.drawio` |
| Cloudflare dashboard | Account "Sbr@…'s Account" → Workers & Pages → `cmg-video-fallback`; R2 → `cmg-video-backup` |

## Settings (in `.env.local` and Vercel; never commit the values)

| Name | Used by | Purpose |
|---|---|---|
| `VIMEO_BACKUP_TOKEN` | local scripts, and the Worker secret `VIMEO_TOKEN` | Vimeo token with Public, Private and Video Files scopes (read-only) |
| `CLOUDFLARE_API_TOKEN` | deploying the Worker | Limited token: R2 + Workers Scripts edit, Account Settings read, Workers Routes edit on asianbusinessreview.com and charltonmedia.com |
| `BACKUP_COUNTRIES` | dashboard (Vercel) | Countries that always get the backup, comma-separated ISO codes. Default `ID`. |
| `NEXT_PUBLIC_VIDEO_BACKUP_BASE` | dashboard | Backup address. Default `https://video.charltonmedia.com`. |

## How to…

### Test the backup on any computer (no need to be in Indonesia)
Add `?videoFallback=1` to any dashboard link, for example `/dashboard/editorial/videos?videoFallback=1`. The browser remembers it.
- `?videoFallback=0` forces Vimeo.
- `?videoFallback=clear` goes back to automatic.

To check it's the backup, right-click the video: a plain browser menu means backup.

### Add another country
Change `BACKUP_COUNTRIES` in Vercel (for example `ID,VN`) and redeploy. No code change. Countries where Vimeo fails are already covered automatically by the "can't reach Vimeo" check.

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
- Cloudflare → Workers & Pages → `cmg-video-fallback` → **Observability / Logs** shows lines like `copied <id> …` or `copy failed …`.

### Switch it off
- **Everything:** Workers & Pages → `cmg-video-fallback` → Settings → Domains & Routes → remove `video.charltonmedia.com`. Viewers in Indonesia go back to the broken Vimeo box, and nobody else notices.
- **Dashboard only:** set `BACKUP_COUNTRIES` to an empty value. Viewers who can't reach Vimeo would still switch; to stop that too, revert the dashboard change.

## Known limits
- **China** isn't covered reliably; it would need a China-based video host.
- **Videos from other Vimeo accounts** (for example sponsors embedding their own) can't be backed up. Only videos in the Charlton Media Group Vimeo account are.
- **Backup plays don't show in Vimeo's play counts.** The planned GA4 events and play counter will fill this gap.
- **The backup plays at a fixed 720p.** It doesn't adjust quality automatically on slow connections the way Vimeo does.
