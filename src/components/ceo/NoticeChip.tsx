import styles from "./ceo-dashboard.module.css";

/**
 * A small "▲ 3" chip that opens the notes about a board's data on hover, focus or
 * tap — a failed read, rows the board had to skip, figures it couldn't read — so
 * the board stays clean until someone wants the detail. Shared by every CEO board.
 */
export function NoticeChip({ notices, className }: { notices: string[]; className?: string }) {
  return (
    <div
      className={className ? `${styles.noticeChip} ${className}` : styles.noticeChip}
      tabIndex={0}
      role="button"
      aria-label={`${notices.length} notice${notices.length === 1 ? "" : "s"} about this data`}
    >
      <span aria-hidden="true">▲</span>
      <span className={styles.noticeCount}>{notices.length}</span>
      <div className={styles.noticePopover} role="tooltip">
        <div className={styles.noticePopoverTitle}>Notes on this data</div>
        <ul>
          {notices.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
