import type { ReactNode } from "react";
import { Inter } from "next/font/google";

/**
 * Inter — designed for dense dashboard UI — is the shared body font for every CEO
 * dashboard, so text reads identically on any screen instead of the per-device OS
 * default. It's exposed as `--font-body`, which the panel's base font-family picks
 * up; each board keeps loading Oswald (`--font-title`) for its condensed headers.
 *
 * The wrapper is `display: contents` so it adds no box — it only carries the font
 * variable down to the panels the pages render.
 */
const bodyFont = Inter({ subsets: ["latin"], display: "swap", variable: "--font-body" });

export default function CeoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={bodyFont.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
