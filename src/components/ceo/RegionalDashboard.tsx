import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import { StatTile } from "./StatTile";
import { buildOverdueGauge, buildTargetBullet } from "@/lib/ceo-money/bullet";
import { BUSINESS_DAYS_PER_WEEK } from "@/lib/ceo-money/config";
import { formatWeekRange } from "@/lib/ceo-money/date";
import type { RegionDashboard } from "@/lib/ceo-money/metrics";
import { formatCentsSGD, formatFullSGD } from "@/lib/ceo-money/money";
import { formatAttainment, formatCount, formatPercent } from "@/lib/ceo/format";
import type { DashboardConfig } from "@/lib/ceo-money/types";

export interface RegionView {
  label: string;
  data: RegionDashboard;
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
}: RegionalDashboardProps) {
  // Every region shares the same week, so the header can read it off the first.
  const head = regions[0]?.data;
  const businessDaysElapsed = head ? Math.round(head.businessDayFraction * BUSINESS_DAYS_PER_WEEK) : 0;

  const warnings = regions.flatMap((r) => r.data.warnings.map((w) => `${r.label}: ${w}`));

  // Everything that used to live in the always-on banner, now collected into one
  // list revealed on hover. Status first, then the per-region data warnings.
  const notices: string[] = [];
  if (pinned) notices.push(`Pinned week — showing the week containing ${asOf}, not the current one.`);
  notices.push(
    live
      ? `Live from ${sourceLabel}. Only the revenue targets are invented.`
      : "Sample data — no register connected, every figure is invented.",
  );
  notices.push(...warnings);

  // A plain "live, current week, nothing wrong" state needs no indicator at all.
  const hasNotice = pinned || !live || warnings.length > 0;

  return (
    <section className={styles.panel} data-fullscreen="true" data-notice={hasNotice ? "yes" : "no"} data-regional="true">
      <header className={styles.masthead}>
        <div>
          <h1>Cash, revenue and receivables by region</h1>
          {head && (
            <div className={styles.week}>
              {formatWeekRange(head.weekStart, head.weekEnd)} · {businessDaysElapsed} of {BUSINESS_DAYS_PER_WEEK}{" "}
              business days elapsed · revenue and cash targets pro-rated to that point
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
          <RefreshButton />
        </div>
      </header>

      <div className={styles.regionList}>
        {regions.map(({ label, data }) => (
          <section key={label} className={styles.region}>
            <h2 className={styles.regionLabel}>{label}</h2>
            <div className={styles.kpiRow} data-tiles="3">
              <StatTile
                compact
                label="Cash collected this week"
                value={formatFullSGD(data.cash.actual)}
                rag={data.cash.rag}
                note={data.cash.note}
                subLines={[
                  data.cash.attainment !== null
                    ? `${formatAttainment(data.cash.attainment)} of what the week invoiced`
                    : "Nothing invoiced this week",
                  `${formatCount(data.paidCount)} payment${data.paidCount === 1 ? "" : "s"}, ${
                    data.bankFees > 0 ? `${formatCentsSGD(data.bankFees)} in fees` : "no fees"
                  }`,
                ]}
                bullet={buildTargetBullet(data.cash, config)}
                format={formatFullSGD}
              />
              <StatTile
                compact
                label="Revenue closed this week"
                value={formatFullSGD(data.revenue.actual)}
                rag={data.revenue.rag}
                note={data.revenue.note}
                subLines={[
                  data.revenue.attainment !== null
                    ? `${formatAttainment(data.revenue.attainment)} of pace`
                    : "Awaiting target",
                  data.revenue.fullTarget !== null ? `Week target ${formatFullSGD(data.revenue.fullTarget)}` : "",
                ].filter(Boolean)}
                bullet={buildTargetBullet(data.revenue, config)}
                format={formatFullSGD}
              />
              <StatTile
                compact
                label="Overdue receivables, 30+ days"
                value={formatFullSGD(data.overdue.actual)}
                rag={data.overdue.rag}
                note={data.overdue.note}
                subLines={[
                  data.overdue.ratio !== null
                    ? `${formatPercent(data.overdue.ratio, 1)} of the ${formatFullSGD(data.overdue.outstanding)} owed is overdue`
                    : "Nothing outstanding",
                  `${formatCount(data.overdue.count)} invoice${data.overdue.count === 1 ? "" : "s"} past terms`,
                ]}
                bullet={buildOverdueGauge(data.overdue, config)}
                format={(n) => formatPercent(n, 0)}
              />
            </div>
          </section>
        ))}
      </div>

      <footer className={styles.sourceNote}>
        All figures in SGD · weeks run Friday to Thursday, Asia/Singapore · revenue counts invoices on their issue
        date, cash counts payments on the day they landed, overdue is unpaid invoices 30+ days old as a share of
        what is still owed
      </footer>
    </section>
  );
}
