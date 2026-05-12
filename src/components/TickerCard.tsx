"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  feedUrl: string | string[];
  label?: string;
  duration?: number;
  labelColor?: string;
  limit?: number;
  refreshIntervalMs?: number;
  fontSize?: string;
  height?: string;
}

export default function TickerCard({
  feedUrl,
  label = "Exclusive",
  duration = 4000,
  labelColor = "#ff0000",
  limit = 10,
  refreshIntervalMs = 10 * 60 * 1000,
  fontSize,
  height,
}: Props) {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);

  const feedUrls = Array.isArray(feedUrl) ? feedUrl : [feedUrl];
  const feedKey = feedUrls.join("|");

  useEffect(() => {
    const urls = feedUrls.filter(Boolean);
    if (!urls.length) return;
    const parseTitles = (xml: string): string[] => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const items = doc.querySelectorAll("item");
      if (items.length) {
        return Array.from(items).map(
          (i) => i.querySelector("title")?.textContent?.trim() || "Untitled",
        );
      }
      return Array.from(doc.querySelectorAll("entry")).map(
        (e) => e.querySelector("title")?.textContent?.trim() || "Untitled",
      );
    };
    const load = async () => {
      try {
        const results = await Promise.all(
          urls.map(async (u) => {
            try {
              const res = await fetch(`${u}?cache=${Date.now()}`);
              return parseTitles(await res.text());
            } catch {
              return [] as string[];
            }
          }),
        );
        const interleaved: string[] = [];
        const max = Math.max(...results.map((r) => r.length), 0);
        for (let i = 0; i < max; i++) for (const r of results) if (r[i]) interleaved.push(r[i]);
        setHeadlines(interleaved.slice(0, limit));
      } catch {}
    };
    load();
    const id = setInterval(load, refreshIntervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKey, limit, refreshIntervalMs]);

  useEffect(() => {
    const sc = scrollRef.current;
    const el = headlineRef.current;
    if (!sc || !el) return;
    const containerWidth = sc.offsetWidth;
    const headlineWidth = el.scrollWidth;
    if (headlineWidth > containerWidth) {
      const PAD = 24;
      const distance = headlineWidth - containerWidth + PAD;
      const speed = 30;
      const scrollDuration = (distance / speed) * 1000;
      const start = setTimeout(() => {
        el.style.transition = `transform ${scrollDuration}ms linear`;
        el.style.transform = `translateX(-${distance}px)`;
        setTimeout(() => {
          el.style.transition = "";
          el.style.transform = "translateX(0)";
          setCurrentIndex((i) => (i + 1) % Math.max(headlines.length, 1));
        }, scrollDuration + 500);
      }, duration);
      return () => clearTimeout(start);
    }
    const t = setTimeout(
      () => setCurrentIndex((i) => (i + 1) % Math.max(headlines.length, 1)),
      duration,
    );
    return () => clearTimeout(t);
  }, [currentIndex, headlines, duration]);

  return (
    <div style={{ ...styles.ticker, ...(height ? { height } : null) }}>
      <div
        style={{
          ...styles.label,
          backgroundColor: labelColor,
          ...(fontSize
            ? {
                fontSize: "clamp(11px, 1.4vw, 22px)",
                width: "clamp(82px, 14vw, 240px)",
              }
            : null),
        }}
      >
        {label}
      </div>
      <div
        style={{ ...styles.scroll, ...(height ? { minHeight: height } : null) }}
        ref={scrollRef}
      >
        {headlines.map((h, i) => (
          <div
            key={i}
            style={{
              ...styles.wrapper,
              ...(fontSize ? { fontSize } : null),
              opacity: i === currentIndex ? 1 : 0,
              transform: i === currentIndex ? "translateY(-50%)" : "translateY(50%)",
            }}
          >
            <div ref={i === currentIndex ? headlineRef : null} style={styles.inner}>
              {h}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  ticker: {
    display: "flex",
    alignItems: "center",
    fontSize: "clamp(1.5rem, 1.8vw, 2.1rem)",
    color: "black",
    height: "65px",
    fontFamily: '"DIN-Bold", Arial, sans-serif',
    overflow: "hidden",
    width: "100%",
    backgroundColor: "#F0F0F0",
  },
  label: {
    width: "clamp(130px, 10vw, 200px)",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textTransform: "uppercase",
    color: "white",
    alignSelf: "stretch",
    flexShrink: 0,
    fontSize: "clamp(14px, 1.4vw, 28px)",
    whiteSpace: "nowrap",
  },
  scroll: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    minHeight: "65px",
  },
  wrapper: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    paddingLeft: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    fontSize: "clamp(14px, 1.4vw, 28px)",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    backgroundColor: "#F2F2F2",
    transition: "transform 0.6s ease, opacity 0.6s ease",
  },
  inner: {
    display: "inline-block",
    whiteSpace: "nowrap",
    willChange: "transform",
  },
};
