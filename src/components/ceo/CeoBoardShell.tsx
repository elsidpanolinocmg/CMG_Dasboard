import type { ReactNode } from "react";
import { Oswald } from "next/font/google";
import ViewportFit from "@/components/ViewportFit";
import styles from "./ceo-dashboard.module.css";
import { CeoStatTiles, type StatTileSpec } from "./CeoStatTiles";
import { NoticeChip } from "./NoticeChip";
import { formatSgtTimestamp } from "@/lib/ceo/format";

// Oswald for the condensed title/KPI numbers. Body text is Inter, supplied as
// --font-body by the CEO layout and applied through the panel's base font.
const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface CeoBoardShellProps {
  title: string;
  /** The period the board covers, e.g. "2026". */
  period: string;
  /** When the sheet was last edited (ISO), shown as "Updated …". */
  updatedAt: string | null;
  /** Set when the sheet couldn't be read and saved figures are shown instead. */
  staleSince?: string | null;
  /** True when the figures came from the sheet. */
  live: boolean;
  /**
   * Notes about the data — rows the board had to skip or couldn't fully read, or why
   * a read failed — shown in a notes chip beside the subtitle.
   */
  notes?: string[];
  tiles: StatTileSpec[];
  children: ReactNode;
}

/**
 * The frame every CEO deliverable tracker shares: a full-screen panel with the
 * title card (title, period, last-updated time and summary tiles) above the board.
 *
 * It also owns how a board admits its data isn't current — saved figures after a
 * failed read, or no figures at all — so all four say it the same way.
 */
export function CeoBoardShell({
  title,
  period,
  updatedAt,
  staleSince,
  live,
  notes = [],
  tiles,
  children,
}: CeoBoardShellProps) {
  const subtitle = [period, updatedAt ? `Updated ${formatSgtTimestamp(updatedAt)}` : null].filter(Boolean).join(" · ");

  let notice: string | null = null;
  if (staleSince) notice = `⚠ Sheet unreachable — showing figures saved ${formatSgtTimestamp(staleSince)}`;
  // With no figures, notes mean a read was attempted and failed; none means no sheet.
  else if (!live) notice = notes.length ? "⚠ Couldn't read the sheet — retrying automatically" : "No sheet connected — no figures available.";

  return (
    <section className={`${styles.panel} ${titleFont.variable}`} data-fullscreen="true" data-sfv="true">
      <ViewportFit />

      <header className={`${styles.masthead} ${styles.delivHeaderCard}`}>
        <div className={styles.delivTitleBlock}>
          <h1>{title}</h1>
          <div className={styles.week}>
            {subtitle}
            {notice && (
              <>
                {" · "}
                <span className={styles.delivNotice} data-kind={staleSince || notes.length ? "warning" : undefined}>
                  {notice}
                </span>
              </>
            )}
            {notes.length > 0 && <NoticeChip notices={notes} className={styles.delivNoticeChip} />}
          </div>
        </div>
        <CeoStatTiles tiles={tiles} />
      </header>

      {children}
    </section>
  );
}
