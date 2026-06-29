"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  feedUrl: string | string[];
  label?: string;
  speed?: number;
  labelColor?: string;
  limit?: number;
  refreshIntervalMs?: number;
  fontSize?: string;
  height?: string;
}

export default function TickerStrip({
  feedUrl,
  label = "Latest News",
  speed = 60,
  labelColor = "#074782",
  limit = 10,
  refreshIntervalMs = 10 * 60 * 1000,
  fontSize,
  height,
}: Props) {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const headlinesRef = useRef<HTMLSpanElement>(null);

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
    const headlinesEl = headlinesRef.current;
    const containerEl = containerRef.current;
    if (!headlinesEl || !containerEl || headlines.length === 0) return;
    const contentWidth = headlinesEl.offsetWidth;
    const containerWidth = containerEl.offsetWidth;
    if (contentWidth <= containerWidth) {
      headlinesEl.style.animation = "";
      headlinesEl.style.transform = "translateX(0)";
      return;
    }
    const duration = (contentWidth + containerWidth) / speed;
    const animName = "scrollAnim_" + Date.now();
    document.getElementById("dynamic-scroll-style")?.remove();
    const styleTag = document.createElement("style");
    styleTag.id = "dynamic-scroll-style";
    styleTag.innerHTML = `
      @keyframes ${animName} {
        0% { transform: translateX(${containerWidth}px); }
        100% { transform: translateX(${-contentWidth}px); }
      }
    `;
    document.head.appendChild(styleTag);
    headlinesEl.style.animation = `${animName} ${duration}s linear infinite`;
    headlinesEl.style.willChange = "transform";
  }, [headlines, speed]);

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
      <div ref={containerRef} style={styles.scroll}>
        <span
          ref={headlinesRef}
          style={{ ...styles.headlines, ...(fontSize ? { fontSize } : null) }}
        >
          {headlines.map((h, i) => (
            <span key={i} style={styles.item}>
              {h.toUpperCase()}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  ticker: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    overflow: "hidden",
    fontSize: "clamp(1.5rem, 1.8vw, 2.1rem)",
    height: "65px",
    fontFamily: '"DIN-Bold", Arial, sans-serif',
    backgroundColor: "#FF0000",
    minWidth: 0,
  },
  label: {
    width: "clamp(130px, 10vw, 200px)",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textTransform: "uppercase",
    alignSelf: "stretch",
    flexShrink: 0,
    textShadow: "0 0 5px rgba(0,0,0,0.5)",
    color: "white",
    fontSize: "clamp(14px, 1.4vw, 28px)",
    whiteSpace: "nowrap",
  },
  scroll: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    position: "relative",
    height: "100%",
    minWidth: 0,
  },
  headlines: {
    display: "inline-block",
    fontWeight: "bold",
    fontSize: "clamp(14px, 1.4vw, 28px)",
    whiteSpace: "nowrap",
    backgroundColor: "#FF0000",
  },
  item: {
    display: "inline-block",
    marginRight: "200px",
    color: "white",
  },
};
