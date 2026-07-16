import styles from "./ceo-dashboard.module.css";
import { RefreshButton } from "./RefreshButton";
import { StatTile } from "./StatTile";
import { formatAttainment, formatPercent, formatSignedPercent } from "@/lib/ceo/format";
import { BUSINESS_DAYS_PER_WEEK, formatWeekRange } from "@/lib/ceo/week";
import { buildCostPerLeadBullet, buildLeadsBullet } from "@/lib/ceo-marketing/bullet";
import { formatCostPerLead, formatLeads } from "@/lib/ceo-marketing/format";
import { buildMarketingDashboard } from "@/lib/ceo-marketing/metrics";
import type { LeadLedger } from "@/lib/ceo-marketing/types";

export interface MarketingDashboardProps {
  ledger: LeadLedger;
  /** Today's date in Asia/Singapore, from `today()`. */
  asOf: string;
  /** Size the panel to the viewport and suppress its own scrolling. */
  fullscreen?: boolean;
  /** True when `asOf` came from the URL/env rather than the clock. */
  pinned?: boolean;
  /** True when figures come from the weekly sheet rather than the generator. */
  leadsLive?: boolean;
  /** Real leads for the week: a number, or null when the sheet has no block yet. */
  leadsOverride?: number | null;
  /** Real cost per lead (average of the sections' rates), or null. */
  cplOverride?: number | null;
  /** The sheet block's own week label, e.g. "Jun 26 - Jul 2, 2026". */
  weekLabel?: string | null;
  leadsWarnings?: string[];
  showRefresh?: boolean;
}

/**
 * Paid leads and cost per lead for the current Friday–Thursday week.
 *
 * Leads are read live from the "Weekly Overall Report" sheet; cost per lead is
 * still sample until its spend definition is settled. The two tiles share the
 * money dashboard's bands and RAG language so a colour means the same thing
 * across pages.
 */
export function MarketingDashboard({
  ledger,
  asOf,
  fullscreen = false,
  pinned = false,
  leadsLive = false,
  leadsOverride,
  cplOverride,
  weekLabel,
  leadsWarnings = [],
  showRefresh = true,
}: MarketingDashboardProps) {
  const data = buildMarketingDashboard(
    ledger,
    asOf,
    leadsLive ? leadsOverride : undefined,
    leadsLive ? cplOverride : undefined,
  );
  const businessDaysElapsed = Math.round(data.businessDayFraction * BUSINESS_DAYS_PER_WEEK);

  const leadsSub = [
    data.leads.attainment !== null
      ? `${formatAttainment(data.leads.attainment)} of target`
      : leadsLive
        ? "No data this week"
        : "Week not started",
    `Week target ${formatLeads(data.leads.fullTarget)} leads`,
  ];

  const cplSub = [
    `Target ${formatCostPerLead(data.costPerLead.target)}`,
    data.costPerLead.overrun !== null
      ? `${formatSignedPercent(data.costPerLead.overrun, 1)} vs target`
      : "Awaiting leads",
  ];

  const hasNotice = pinned || !leadsLive || leadsWarnings.length > 0;

  return (
    <section
      className={styles.panel}
      data-fullscreen={fullscreen ? "true" : "false"}
      data-notice={hasNotice ? "yes" : "no"}
    >
      <header className={styles.masthead}>
        <div>
          <h1>Paid leads and cost per lead</h1>
          <div className={styles.week}>
            {formatWeekRange(data.weekStart, data.weekEnd)} · {businessDaysElapsed} of {BUSINESS_DAYS_PER_WEEK}{" "}
            business days elapsed
          </div>
        </div>
        {showRefresh && <RefreshButton />}
      </header>

      {hasNotice && (
        <div className={styles.banner}>
          <span aria-hidden="true">▲</span>
          <span>
            {pinned && (
              <>
                <strong>Pinned week.</strong> Showing {weekLabel ?? asOf}, not the current one.{" "}
              </>
            )}
            {leadsLive ? (
              <>
                <strong>Live</strong> from the Weekly Overall Report{weekLabel ? ` (${weekLabel})` : ""}. Cost per
                lead is the average of the sections&apos; rates.{" "}
              </>
            ) : (
              <>
                <strong>Sample data.</strong> No marketing sheet is connected, so every figure is invented.{" "}
              </>
            )}
            {leadsWarnings.slice(0, 2).join(" · ")}
          </span>
        </div>
      )}

      <div className={styles.kpiRow} data-tiles="2">
        <StatTile
          label="Paid leads generated this week"
          value={formatLeads(data.leads.actual)}
          rag={data.leads.rag}
          note={data.leads.note}
          subLines={leadsSub}
          bullet={buildLeadsBullet(data.leads, ledger.config)}
          format={formatLeads}
        />
        <StatTile
          label="Cost per lead vs target"
          value={data.costPerLead.actual === null ? "—" : formatCostPerLead(data.costPerLead.actual)}
          rag={data.costPerLead.rag}
          note={data.costPerLead.note}
          subLines={cplSub}
          bullet={buildCostPerLeadBullet(data.costPerLead, ledger.config)}
          format={formatCostPerLead}
        />
      </div>

      <footer className={styles.sourceNote}>
        Weeks run Friday to Thursday, Asia/Singapore · leads are the week&apos;s total across all campaign
        sections · cost per lead is the average of those sections&apos; rates
      </footer>
    </section>
  );
}
