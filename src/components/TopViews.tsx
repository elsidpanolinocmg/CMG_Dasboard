"use client";

import { useEffect, useState } from "react";

interface Props {
  xmlUrl: string;
  brand?: string;
  limit?: number;
  title?: string;
  onError?: () => void;
}

const cache: Record<string, string[]> = {};

export default function TopViews({
  xmlUrl,
  brand = "default",
  limit = 10,
  title = "Top 10 News Last 7 Days",
  onError,
}: Props) {
  const [titles, setTitles] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!xmlUrl) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${xmlUrl}?_ts=${Date.now()}`);
        if (!res.ok) throw new Error("xml fetch failed");
        const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
        const items = Array.from(xml.querySelectorAll("item"))
          .slice(0, limit)
          .map((i) => i.querySelector("title")?.textContent?.trim() || "Untitled");
        if (cancelled) return;
        setTitles(items);
        setError(false);
        cache[brand] = items;
      } catch {
        setError(true);
        if (cache[brand]) {
          setTitles(cache[brand]);
          setError(false);
        }
        onError?.();
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [xmlUrl, brand, limit, onError]);

  if (error && !titles.length) return <div>Failed to load feed</div>;

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{title}</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((t, i) => (
              <tr key={i}>
                <td style={styles.td}>
                  <span style={styles.ellipsis}>{t}</span>
                </td>
              </tr>
            ))}
            {!titles.length && (
              <tr>
                <td style={styles.td}>No articles found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    background: "white",
  },
  container: {
    width: "100%",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    maxWidth: "1920px",
    margin: "0 auto",
  },
  table: {
    width: "100%",
    tableLayout: "fixed",
    borderCollapse: "collapse",
    height: "100%",
    fontSize: "clamp(16px, 3vh, 22px)",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    fontWeight: "bold",
    background: "#f0f0f0",
    borderBottom: "2px solid #ddd",
    color: "#333",
  },
  td: {
    padding: "2px 12px",
    borderBottom: "1px solid #ddd",
    color: "#333",
  },
  ellipsis: {
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
};
