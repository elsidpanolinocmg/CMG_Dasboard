"use client";

import { useEffect, useRef } from "react";

interface Props {
  xmlUrl: string;
  displayTime?: number;
  startIndex?: number;
  onError?: () => void;
}

export default function VideoRotatorXml({
  xmlUrl,
  displayTime = 30,
  startIndex = 0,
  onError,
}: Props) {
  const iframeA = useRef<HTMLIFrameElement>(null);
  const iframeB = useRef<HTMLIFrameElement>(null);
  const titleBox = useRef<HTMLDivElement>(null);

  const videos = useRef<{ title: string; link: string }[]>([]);
  const currentIndex = useRef(startIndex);
  const showingA = useRef(true);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!xmlUrl) return;
    fetch(`${xmlUrl}?_ts=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error("xml fetch failed");
        return res.text();
      })
      .then((xmlText) => {
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        videos.current = Array.from(xml.querySelectorAll("item"))
          .map((item) => ({
            title: item.querySelector("title")?.textContent?.trim() || "",
            link: item.querySelector("description")?.textContent?.trim() || "",
          }))
          .filter((v) => v.link.includes("vimeo.com"));
        if (!videos.current.length) throw new Error("no videos");
        showInitial();
        intervalRef.current = window.setInterval(nextVideo, displayTime * 1000);
      })
      .catch(() => onError?.());

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlUrl, displayTime]);

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    destroy(iframeA.current);
    destroy(iframeB.current);
  };

  const destroy = (f: HTMLIFrameElement | null) => {
    if (!f) return;
    f.src = "";
  };

  const extract = (url: string) => url.match(/vimeo\.com\/(\d+)/)?.[1] || "";

  const loadInto = (f: HTMLIFrameElement | null, link: string) => {
    if (!f) return;
    const id = extract(link);
    if (!id) return;
    f.src = `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&background=1`;
  };

  const showInitial = () => {
    const first = videos.current[currentIndex.current];
    const next = videos.current[(currentIndex.current + 1) % videos.current.length];
    loadInto(iframeA.current, first.link);
    iframeA.current?.classList.add("active");
    if (titleBox.current) titleBox.current.textContent = first.title;
    loadInto(iframeB.current, next.link);
  };

  const nextVideo = () => {
    currentIndex.current = (currentIndex.current + 1) % videos.current.length;
    const current = videos.current[currentIndex.current];
    const next = videos.current[(currentIndex.current + 1) % videos.current.length];
    if (titleBox.current) {
      titleBox.current.style.opacity = "0";
      setTimeout(() => {
        titleBox.current!.textContent = current.title;
        titleBox.current!.style.opacity = "1";
      }, 200);
    }
    if (showingA.current) {
      iframeB.current?.classList.add("active");
      iframeA.current?.classList.remove("active");
      destroy(iframeA.current);
      loadInto(iframeA.current, next.link);
    } else {
      iframeA.current?.classList.add("active");
      iframeB.current?.classList.remove("active");
      destroy(iframeB.current);
      loadInto(iframeB.current, next.link);
    }
    showingA.current = !showingA.current;
  };

  return (
    <>
      <style>{`
        .vrx-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; }
        .vrx-area { position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; }
        .vrx-layer { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; opacity: 0; transition: opacity 1s ease-in-out; }
        .vrx-layer.active { opacity: 1; z-index: 1; }
        .vrx-title { font-size: clamp(16px, 2vh, 22px); font-weight: bold; text-align: center; margin-top: 10px; transition: opacity 0.3s; color: #333; }
      `}</style>
      <div className="vrx-wrap">
        <div className="vrx-area">
          <iframe ref={iframeA} className="vrx-layer" allow="autoplay; fullscreen" />
          <iframe ref={iframeB} className="vrx-layer" allow="autoplay; fullscreen" />
        </div>
        <div ref={titleBox} className="vrx-title" />
      </div>
    </>
  );
}
