"use client";

import { useEffect, useRef } from "react";
import Player from "@vimeo/player";

const EXCLUDED_TITLES_FILTER = /Awards|Event Highlights/i;

interface Cue { start: number; end: number; text: string; }

// WebVTT times can be HH:MM:SS.mmm or MM:SS.mmm. Pop from the end so the
// presence or absence of hours doesn't matter.
const parseVttTime = (t: string): number => {
  const parts = t.split(/[:.,]/).map(Number);
  const ms = parts.pop() ?? 0;
  const s = parts.pop() ?? 0;
  const m = parts.pop() ?? 0;
  const h = parts.pop() ?? 0;
  return h * 3600 + m * 60 + s + ms / 1000;
};

const parseVtt = (vtt: string): Cue[] => {
  const cues: Cue[] = [];
  const lines = vtt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(\S+)\s+-->\s+(\S+)/);
    if (!m) continue;
    const start = parseVttTime(m[1]);
    const end = parseVttTime(m[2]);
    const text: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "") {
      text.push(lines[i].trim().replace(/<[^>]+>/g, ""));
      i++;
    }
    if (text.length) cues.push({ start, end, text: text.join("\n") });
  }
  return cues;
};

interface EditorialVideosRotatorProps {
  xmlUrl?: string | string[];
  videos?: { title: string; link: string }[];
  displayTime?: number;
  startIndex?: number;
  onError?: () => void;
  // When true, enables TV-safe behaviour: end-of-cycle soft reload,
  // continuous stall detection piggy-backed on the caption poll, and a
  // 25-minute hard-floor safety reload. Off by default so PC viewers and
  // other consumers (bizzcon, awards) aren't interrupted.
  tvMode?: boolean;
  // Called at the end of every full cycle in TV mode. The parent is
  // expected to remount this component (e.g. by changing its key), which
  // tears down iframes/decoders without navigating away — so fullscreen
  // state is preserved. If omitted, falls back to window.location.reload().
  onCycleReload?: () => void;
}

export default function EditorialVideosRotator({
  xmlUrl,
  videos: directVideos,
  displayTime = 30,
  startIndex = 0,
  onError,
  tvMode = false,
  onCycleReload,
}: EditorialVideosRotatorProps) {
  const containerA = useRef<HTMLDivElement>(null);
  const containerB = useRef<HTMLDivElement>(null);
  const playerA = useRef<Player | null>(null);
  const playerB = useRef<Player | null>(null);
  const titleBox = useRef<HTMLDivElement>(null);
  const captionBox = useRef<HTMLDivElement>(null);

  const videos = useRef<{ title: string; link: string }[]>([]);
  const currentIndex = useRef(startIndex);
  const showingA = useRef(true);
  const intervalRef = useRef<number | null>(null);

  // Cached parsed cues per slot so preloads can have their VTT ready before
  // activation. Populated async by loadInto; read by the caption sync timer.
  const cuesA = useRef<Cue[]>([]);
  const cuesB = useRef<Cue[]>([]);
  // Single polling timer that reads the currently-active player's currentTime
  // and pushes matching cue text into captionBox. Only one is alive at a time.
  // In TV mode this same poll also drives stall detection.
  const captionTimer = useRef<number | null>(null);
  const captionPlayer = useRef<Player | null>(null);

  // TV mode state in a ref so long-lived closures (setInterval callbacks,
  // player event handlers) always see the latest toggle value without
  // having to be torn down and restarted.
  const tvModeRef = useRef(tvMode);
  tvModeRef.current = tvMode;

  // Same pattern for the cycle-reload callback — nextVideo is captured by
  // the rotation interval the first time the useEffect runs, so without
  // a ref it would call a stale onCycleReload if the prop changed.
  const onCycleReloadRef = useRef(onCycleReload);
  onCycleReloadRef.current = onCycleReload;

  // End-of-cycle reload counter. Increments on every rotation — natural or
  // forced by the stall detector. Force-skips still count because the
  // rotator advances through the playlist in order regardless of how long
  // each video actually played, so counter === videos.length means we
  // loaded every video once.
  const rotationsInCycle = useRef(0);

  const urlList = Array.isArray(xmlUrl) ? xmlUrl : xmlUrl ? [xmlUrl] : [];
  const urlKey = urlList.join("|");
  const directKey = directVideos ? directVideos.map((v) => v.link).join("|") : "";

  /* ---------- LOAD DIRECT VIDEOS ---------- */
  useEffect(() => {
    if (!directVideos || !directVideos.length) return;
    videos.current = directVideos.filter((v) => v.link.includes("vimeo.com"));
    if (!videos.current.length) return;
    showInitial();
    intervalRef.current = window.setInterval(nextVideo, displayTime * 1000);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directKey, displayTime]);

  /* ---------- LOAD XML ---------- */
  useEffect(() => {
    if (directVideos && directVideos.length) return;
    const urls = urlList.filter(Boolean);
    if (!urls.length) return;

    const parseItems = (xmlText: string) => {
      const xml = new DOMParser().parseFromString(xmlText, "application/xml");
      return Array.from(xml.querySelectorAll("item"))
        .map(item => ({
          title: item.querySelector("title")?.textContent?.trim() || "",
          link: item.querySelector("description")?.textContent?.trim() || "",
        }))
        .filter(v => v.link.includes("vimeo.com") && !EXCLUDED_TITLES_FILTER.test(v.title));
    };

    Promise.all(
      urls.map(u =>
        fetch(u + "?_ts=" + Date.now())
          .then(res => (res.ok ? res.text() : Promise.reject(new Error("XML fetch failed"))))
          .then(parseItems)
          .catch(() => [] as { title: string; link: string }[]),
      ),
    )
      .then(results => {
        const merged: { title: string; link: string }[] = [];
        const maxLen = Math.max(...results.map(r => r.length), 0);
        for (let i = 0; i < maxLen; i++) {
          for (const r of results) if (r[i]) merged.push(r[i]);
        }

        videos.current = merged;
        if (!videos.current.length) throw new Error("No videos");

        showInitial();

        intervalRef.current = window.setInterval(nextVideo, displayTime * 1000);
      })
      .catch(err => {
        console.error(err);
        onError?.();
      });

    return cleanup;
  }, [urlKey, displayTime]);

  /* ---------- TV MODE SAFETY RELOAD ---------- */
  // Belt-and-suspenders for the end-of-cycle soft reload. Intentionally a
  // HARD reload (window.location.reload) so it also flushes any memory the
  // soft remount couldn't release — decoder slots stuck in the TV browser,
  // Vimeo SDK internals, parent-page heap. Fullscreen briefly exits when
  // this fires, but it only fires if the cycle counter, caption poll, and
  // stall detector all failed to complete a cycle within 25 minutes.
  useEffect(() => {
    if (!tvMode) return;
    const timer = window.setTimeout(
      () => window.location.reload(),
      25 * 60 * 1000,
    );
    return () => clearTimeout(timer);
  }, [tvMode]);

  /* ---------- CAPTION SYNC ---------- */
  // Polls the active player's currentTime and renders the matching cue into
  // captionBox. Kept deliberately tied to a single player reference so a
  // stale timer (player destroyed mid-poll) bails without touching the new
  // player's captions.
  const stopCaptionSync = () => {
    if (captionTimer.current) {
      clearInterval(captionTimer.current);
      captionTimer.current = null;
    }
    captionPlayer.current = null;
    if (captionBox.current) captionBox.current.textContent = "";
  };

  const startCaptionSync = (
    player: Player,
    cuesRef: React.RefObject<Cue[]>,
  ) => {
    stopCaptionSync();
    captionPlayer.current = player;

    // Stall-detection state is closure-local so each new player starts
    // fresh. We piggyback on the caption poll — there's no second timer.
    let lastPolledTime = -1;
    let stalledTicks = 0;

    captionTimer.current = window.setInterval(async () => {
      if (captionPlayer.current !== player) return;
      try {
        const now = await player.getCurrentTime();
        if (captionPlayer.current !== player) return;

        const active = cuesRef.current.find(c => now >= c.start && now <= c.end);
        if (captionBox.current) {
          captionBox.current.textContent = active?.text ?? "";
        }

        // Stall detector (TV mode only). If currentTime hasn't advanced
        // across ~2 s of polling, the video is frozen — force a skip.
        // A loop:true wrap (duration → 0) isn't a stall because the
        // diff jumps, not stays near zero.
        if (tvModeRef.current) {
          if (lastPolledTime >= 0 && Math.abs(now - lastPolledTime) < 0.05) {
            stalledTicks++;
            if (stalledTicks >= 8) {
              stalledTicks = 0;
              lastPolledTime = -1;
              // Reset the rotation clock so the replacement video gets
              // a full displayTime, not the leftover slice of this one.
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = window.setInterval(
                  nextVideo,
                  displayTime * 1000,
                );
              }
              nextVideo();
            }
          } else {
            stalledTicks = 0;
            lastPolledTime = now;
          }
        }
      } catch {}
    }, 250);
  };

  /* ---------- CLEANUP ---------- */
  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopCaptionSync();
    destroyPlayer(playerA);
    destroyPlayer(playerB);
  };

  const destroyPlayer = (playerRef: React.RefObject<Player | null>) => {
    playerRef.current?.destroy().catch(() => {});
    playerRef.current = null;
  };

  /* ---------- LOAD VIDEO ---------- */
  const loadInto = (
    container: HTMLDivElement | null,
    playerRef: React.RefObject<Player | null>,
    link: string,
    paused = false,
  ) => {
    if (!container) return;
    const id = extractVimeoId(link);
    if (!id) return;

    playerRef.current?.destroy().catch(() => {});
    playerRef.current = null;
    container.innerHTML = "";

    const player = new Player(container, {
      id: Number(id),
      // preloads use autoplay:false so ready()→pause() race can't happen
      autoplay: !paused,
      muted: true,
      controls: false,
      loop: true,   // loop short videos so they never freeze on the last frame
      transparent: true,
      width: container.offsetWidth || 1280,
      height: container.offsetHeight || 720,
    });

    playerRef.current = player;

    // Reset cues for this slot so a stale VTT from the previous video never
    // leaks into the new one if the fetch below fails or is slow.
    const cuesTargetRef = playerRef === playerA ? cuesA : cuesB;
    cuesTargetRef.current = [];

    // Each async Vimeo call can land after the player is destroyed (next
    // rotation, unmount, or a failed load), which the SDK logs as
    // "Unknown player. Probably unloaded." Bail out as soon as the ref
    // no longer points at this player.
    const alive = () => playerRef.current === player;

    player.ready().then(async () => {
      if (!alive()) return;
      if (!paused) player.play().catch(() => {});

      try {
        const tracks = await player.getTextTracks();
        if (!alive()) return;
        const track =
          tracks.find(t => t.kind === "captions") ??
          tracks.find(t => t.kind === "subtitles") ??
          tracks[0];
        if (!track) return;

        // Fetch captions via our server-side proxy. The browser can't hit
        // Vimeo's /config endpoint directly (CORS + 403), so the API route
        // does it server-side and streams the raw .vtt body back to us.
        // This keeps Vimeo's in-iframe caption rendering off — we drive our
        // own overlay via the polling timer — so there's no double caption.
        try {
          const res = await fetch(`/api/vimeo-captions/${id}`);
          if (res.ok) {
            const vtt = await res.text();
            if (!alive()) return;
            cuesTargetRef.current = parseVtt(vtt);
            return;
          }
        } catch {}

        // Fallback: proxy failed (no caption track, Vimeo 403 even
        // server-side, private video requiring a hash, etc.). Enable
        // Vimeo's native captions so at least one set shows; cuesTargetRef
        // stays empty so our overlay sits idle and no double appears.
        await player.enableTextTrack(track.language, track.kind);
      } catch {}
    }).catch(() => {});
  };

  /* ---------- ACTIVATE + CROSSFADE ---------- */
  // Waits until the incoming player is actually playing before crossfading,
  // so the outgoing video stays visible during buffering (no blank-frame flash).
  const activateAndSwitch = (
    incomingPlayer: Player | null,
    incomingContainer: React.RefObject<HTMLDivElement | null>,
    outgoingContainer: React.RefObject<HTMLDivElement | null>,
    afterSwitch: () => void,
  ) => {
    // Stop polling against the outgoing player immediately; the last thing
    // we want is a 250ms-late poll writing the old player's cue text into
    // captionBox while the crossfade is happening.
    stopCaptionSync();

    let done = false;
    const doSwitch = () => {
      if (done) return;
      done = true;
      incomingContainer.current?.classList.add("active");
      outgoingContainer.current?.classList.remove("active");
      afterSwitch();
      watchPlayback(incomingPlayer);
      if (incomingPlayer) {
        const cuesRef = incomingPlayer === playerA.current ? cuesA : cuesB;
        startCaptionSync(incomingPlayer, cuesRef);
      }
    };

    if (!incomingPlayer) { doSwitch(); return; }

    // Fallback: switch anyway after 4 s if the video never fires 'playing'
    const fallback = setTimeout(doSwitch, 4000);

    const handler = () => {
      clearTimeout(fallback);
      incomingPlayer.off("playing", handler);
      doSwitch();
    };

    incomingPlayer.on("playing", handler);
    incomingPlayer.play().catch(() => { clearTimeout(fallback); doSwitch(); });
  };

  /* ---------- PLAYBACK WATCHDOG ---------- */
  // Some Vimeo videos end up "active" but stuck on the poster frame
  // (embed restrictions, autoplay policy, or a slow buffer after the
  // preload→play switch). If currentTime hasn't advanced 2.5 s after
  // the crossfade, skip the stuck video and reset the rotation clock.
  const watchPlayback = (player: Player | null) => {
    if (!player) return;
    // Only touch the player while it is still the active or preload instance;
    // once destroyed, Vimeo's SDK logs "Unknown player. Probably unloaded."
    const alive = () => playerA.current === player || playerB.current === player;

    let startTime = 0;
    if (!alive()) return;
    player.getCurrentTime().then(t => { if (alive()) startTime = t; }).catch(() => {});

    setTimeout(async () => {
      if (!alive()) return;
      try {
        const now = await player.getCurrentTime();
        if (!alive()) return;
        if (now - startTime < 0.2) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = window.setInterval(nextVideo, displayTime * 1000);
          }
          nextVideo();
        }
      } catch {}
    }, 2500);
  };

  /* ---------- INITIAL ---------- */
  const showInitial = () => {
    const first = videos.current[currentIndex.current];
    const next = videos.current[(currentIndex.current + 1) % videos.current.length];

    loadInto(containerA.current, playerA, first.link);
    containerA.current?.classList.add("active");

    if (titleBox.current) titleBox.current.textContent = first.title;

    // Preload next video paused so it doesn't compete for bandwidth
    loadInto(containerB.current, playerB, next.link, true);

    // The first video never goes through activateAndSwitch, so wire its
    // caption sync up directly. cuesA may still be empty here (VTT fetches
    // async) — the polling timer just shows nothing until cues land.
    if (playerA.current) startCaptionSync(playerA.current, cuesA);
  };

  /* ---------- ROTATION ---------- */
  const nextVideo = () => {
    rotationsInCycle.current++;

    // End-of-cycle behaviour. At this point every video has been loaded
    // once — either played for its full displayTime or force-skipped by
    // the stall detector (which still advances through the playlist).
    if (rotationsInCycle.current >= videos.current.length) {
      if (tvModeRef.current) {
        // Soft reload: let the parent remount this component so iframes
        // and decoders get torn down without navigating away — that way
        // fullscreen survives. Fall back to a hard reload if no callback
        // was provided so the memory-leak fix still works standalone.
        cleanup();
        if (onCycleReloadRef.current) {
          onCycleReloadRef.current();
        } else {
          window.location.reload();
        }
        return;
      }
      // Non-TV: just keep rotating; reset so the counter doesn't grow
      // unbounded across long-running sessions.
      rotationsInCycle.current = 0;
    }

    currentIndex.current = (currentIndex.current + 1) % videos.current.length;

    const current = videos.current[currentIndex.current];
    const next = videos.current[(currentIndex.current + 1) % videos.current.length];

    if (titleBox.current) {
      titleBox.current.style.opacity = "0";
      setTimeout(() => {
        // Ref may have been nulled during the 200ms window — e.g., the
        // TV-mode end-of-cycle reload unmounts the component mid-timeout.
        if (!titleBox.current) return;
        titleBox.current.textContent = current.title;
        titleBox.current.style.opacity = "1";
      }, 200);
    }

    if (showingA.current) {
      activateAndSwitch(playerB.current, containerB, containerA, () => {
        destroyPlayer(playerA);
        loadInto(containerA.current, playerA, next.link, true);
      });
    } else {
      activateAndSwitch(playerA.current, containerA, containerB, () => {
        destroyPlayer(playerB);
        loadInto(containerB.current, playerB, next.link, true);
      });
    }

    showingA.current = !showingA.current;
  };

  const extractVimeoId = (url: string) =>
    // Handles: vimeo.com/ID, player.vimeo.com/video/ID, vimeo.com/*/ID
    url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ||
    url.match(/vimeo\.com\/[^/\s]+\/(\d+)/)?.[1] ||
    "";

  /* ---------- UI ---------- */
  return (
    <>
      <style>{`
        .video-wrapper {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
        }

        .video-area {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
        }

        .video-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          transition: opacity 1s ease-in-out;
          overflow: hidden;
        }

        .video-layer.active {
          opacity: 1;
          z-index: 1;
        }

        .video-layer iframe {
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          display: block;
        }

        .video-title {
          font-size: clamp(16px, 2vh, 22px);
          font-weight: bold;
          text-align: center;
          margin-top: 10px;
          transition: opacity 0.3s;
          color: #333;
        }

        .caption-overlay {
          position: absolute;
          bottom: 20%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          width: 80%;
          text-align: center;
          pointer-events: none;
          color: white;
          font-size: clamp(22px, 3.2vw, 42px);
          line-height: 1.5;
          white-space: pre-line;
        }

        .caption-overlay:not(:empty) {
          background: rgba(0, 0, 0, 0.72);
          padding: 4px 14px;
          border-radius: 3px;
        }
      `}</style>

      <div className="video-wrapper">
        <div className="video-area">
          <div ref={containerA} className="video-layer" />
          <div ref={containerB} className="video-layer" />
          <div ref={captionBox} className="caption-overlay" />
        </div>
        <div ref={titleBox} className="video-title" />
      </div>
    </>
  );
}
