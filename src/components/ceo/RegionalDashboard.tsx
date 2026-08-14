import Link from "next/link";
import { Oswald } from "next/font/google";
import DashboardControls from "@/components/DashboardControls";
import styles from "./ceo-dashboard.module.css";
import { OverdueChart } from "./OverdueChart";
import { RefreshButton } from "./RefreshButton";
import { StatTile } from "./StatTile";
import { buildTargetBullet } from "@/lib/ceo-money/bullet";
import { formatBusinessWeek } from "@/lib/ceo-money/reporting-week";
import type { RegionDashboard } from "@/lib/ceo-money/metrics";
import { formatCentsUSD, formatCompactUSD, formatFullUSD } from "@/lib/ceo-money/money";
import type { OverdueSeries } from "@/lib/ceo-money/overdue-series";
import { formatAttainment, formatCount } from "@/lib/ceo/format";
import type { Rag } from "@/lib/ceo/rag";
import type { DashboardConfig } from "@/lib/ceo-money/types";

// The masthead title's display face — the same condensed Oswald used by the
// marketing dashboard, self-hosted by next/font (no runtime request).
const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

export interface RegionView {
  label: string;
  data: RegionDashboard;
}

/** One account tab in the money nav. */
export interface AccountLink {
  key: string;
  label: string;
  href: string;
}

export interface RegionalDashboardProps {
  asOf: string;
  pinned: boolean;
  /** True when the figures come from the sheet rather than the sample generator. */
  live: boolean;
  /** The workbook tab set, for the banner. */
  sourceLabel: string;
  regions: RegionView[];
  config: DashboardConfig;
  /** The account tabs to offer in the controls nav. */
  accounts?: AccountLink[];
  /** Which account this page is showing, highlighted in the nav. */
  activeAccount?: string;
  /** A caveat about which week is on screen, e.g. following the sheet's latest. */
  weekNote?: string | null;
}

/**
 * Cash, revenue and overdue receivables for several regions at once — one row of
 * three cards per region.
 *
 * A server component: the registers are read on the server with the app's OAuth
 * token, and only the finished numbers cross into this tree.
 */
export function RegionalDashboard({
  asOf,
  pinned,
  live,
  sourceLabel,
  regions,
  config,
  accounts = [],
  activeAccount,
  weekNote,
}: RegionalDashboardProps) {
  // Every region shares the same week, so the header can read it off the first.
  const head = regions[0]?.data;

  const warnings = regions.flatMap((r) => r.data.warnings.map((w) => `${r.label}: ${w}`));

  // Everything that used to live in the always-on banner, now collected into one
  // list revealed on hover. Status first, then the per-region data warnings.
  const notices: string[] = [];
  if (pinned) notices.push(`Pinned week — showing the week containing ${asOf}, not the current one.`);
  if (weekNote) notices.push(weekNote);
  notices.push(
    live
      ? `Live from ${sourceLabel}. Only the revenue targets are invented.`
      : "Sample data — no register connected, every figure is invented.",
  );
  notices.push(...warnings);

  // A plain "live, current week, nothing wrong" state needs no indicator at all.
  const hasNotice = pinned || !!weekNote || !live || warnings.length > 0;

  return (
    <section
      className={`${styles.panel} ${titleFont.variable}`}
      data-fullscreen="true"
      data-notice={hasNotice ? "yes" : "no"}
      data-regional="true"
      data-money="true"
      data-regions={regions.length}
    >
      <header className={styles.masthead}>
        <div>
          <h1>Cash, Revenue and Overdue Receivables</h1>
          {head && (
            <div className={styles.week}>
              {formatBusinessWeek(head.weekStart, head.weekEnd)} · last fully-settled Fri–Thu week · targets shown in
              full
            </div>
          )}
        </div>
        <div className={styles.mastheadTools}>
          {hasNotice && (
            <div
              className={styles.noticeChip}
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
          )}
        </div>
      </header>

      <div className={styles.regionList}>
        {regions.map(({ label, data }) => (
          <section key={label} className={styles.region}>
            <h2 className={styles.regionLabel}>{label}</h2>
            <div className={styles.regionGrid}>
              <div className={styles.regionTopRow}>
                <StatTile
                  compact
                  label="Cash Collected This Week"
                value={formatFullUSD(data.cash.actual)}
                rag={data.cash.rag}
                note={data.cash.note}
                subLines={[
                  data.cash.attainment !== null
                    ? `${formatAttainment(data.cash.attainment)} of what the week invoiced`
                    : "Nothing invoiced this week",
                  `${formatCount(data.paidCount)} payment${data.paidCount === 1 ? "" : "s"}, ${
                    data.bankFees > 0 ? `${formatCentsUSD(data.bankFees)} in fees` : "no fees"
                  }`,
                ]}
                bullet={buildTargetBullet(data.cash, config)}
                format={formatFullUSD}
              />
              <StatTile
                compact
                label="Revenue Invoiced This Week"
                value={formatFullUSD(data.revenue.actual)}
                rag={data.revenue.rag}
                note={data.revenue.note}
                subLines={[
                  data.revenue.attainment !== null
                    ? `${formatAttainment(data.revenue.attainment)} of pace`
                    : "Awaiting target",
                  data.revenue.fullTarget !== null ? `Week target ${formatFullUSD(data.revenue.fullTarget)}` : "",
                ].filter(Boolean)}
                bullet={buildTargetBullet(data.revenue, config)}
                format={formatFullUSD}
                />
              </div>
              <OverdueCard series={data.overdueSeries} />
            </div>
          </section>
        ))}
      </div>

      <DashboardControls>
        <Link
          href="/dashboard/ceo"
          className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70"
        >
          ← Back
        </Link>
        {accounts.length > 0 && (
          <nav className="flex items-center gap-2" aria-label="Account">
            {accounts.map((a) => {
              const active = a.key === activeAccount;
              return (
                <Link
                  key={a.key}
                  href={a.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-lg bg-white/25 px-5 py-3 text-lg text-white ring-1 ring-white/40"
                      : "rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70"
                  }
                >
                  {a.label}
                </Link>
              );
            })}
          </nav>
        )}
        <RefreshButton className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70 disabled:opacity-60" />
      </DashboardControls>
    </section>
  );
}

/**
 * The overdue-receivables card: the current balance and a YTD line chart against
 * last year and the target. Less is better, so the RAG turns on how far the
 * balance sits above the target ceiling.
 */
function OverdueCard({ series }: { series: OverdueSeries }) {
  const { current, target } = series;
  const rag: Rag = current <= target ? "good" : current <= target * 1.25 ? "warning" : "critical";
  const over = current > target;
  const note = over ? "Above target" : "Within target";
  const gap = `${formatCompactUSD(Math.abs(current - target))} ${over ? "over" : "under"} target`;

  return (
    <section
      className={`${styles.tile} ${styles.overdueTile}`}
      data-rag={rag}
      data-compact="true"
      aria-label={`Overdue receivables, 30+ days: ${formatFullUSD(current)}, ${note}`}
    >
      <div className={styles.tileLabel}>Overdue receivables, 30+ days</div>
      <div className={styles.tileValue}>{formatFullUSD(current)}</div>
      <div className={styles.tileSub}>
        <span>{gap}</span>
        <span className={styles.overdueLegend}>
          <em className={styles.legThis} aria-hidden="true" /> {series.thisYearLabel}
          <em className={styles.legPrior} aria-hidden="true" /> {series.priorYearLabel}
        </span>
      </div>

      <OverdueChart series={series} />

      <div className={styles.tileFoot}>
        <span className={styles.badge} data-rag={rag}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.glyph} aria-hidden="true" />
          {note}
        </span>
      </div>
    </section>
  );
}
