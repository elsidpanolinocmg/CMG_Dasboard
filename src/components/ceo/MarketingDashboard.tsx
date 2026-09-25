import type { ReactNode } from "react";
import Link from "next/link";
import { Oswald } from "next/font/google";
import DashboardControls from "@/components/DashboardControls";
import styles from "./ceo-dashboard.module.css";
import { DonutChart } from "./DonutChart";
import { NoticeChip } from "./NoticeChip";
import { RefreshButton } from "./RefreshButton";
import { cachePrefixes } from "@/lib/cache/keys";
import { StatTile } from "./StatTile";
import { formatAttainment, formatSignedPercent } from "@/lib/ceo/format";
import { BUSINESS_DAYS_PER_WEEK, formatWeekRange, fromEpochDay, toEpochDay, weekEnd, weekStart } from "@/lib/ceo/week";
import { MARKETING_CONFIG } from "@/lib/ceo-marketing/config";
import { formatCostPerLead, formatLeads } from "@/lib/ceo-marketing/format";
import type { CategoryTotals } from "@/lib/ceo-marketing/marketing-sheet";
import { buildLeadsMetric, cplMetricFromActual } from "@/lib/ceo-marketing/metrics";
import type { CostPerLeadMetric, LeadsMetric } from "@/lib/ceo-marketing/types";

// The dashboard title's display face, self-hosted by next/font (no runtime request).
const titleFont = Oswald({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-title" });

const money = new Intl.NumberFormat("en-US");
const fmtSpend = (n: number | null) => (n === null ? "—" : `S$${money.format(Math.round(n))}`);

export interface MarketingDashboardProps {
  categories: CategoryTotals[];
  /** Today's date in Asia/Singapore, from `today()`. */
  asOf: string;
  /** True when `asOf` came from the URL/env rather than the clock. */
  pinned?: boolean;
  /** True when the figures come from the sheet rather than nothing being configured. */
  live?: boolean;
  /** The sheet block's own week label, e.g. "Jun 26 - Jul 2, 2026". */
  weekLabel?: string | null;
  /** A caveat about which week is on screen, e.g. following the sheet's latest. */
  weekNote?: string | null;
  warnings?: string[];
}

/**
 * Paid leads and cost per lead for the Friday–Thursday week, broken out by
 * campaign category — Awards, Bizcon, Sales and Awards.info — laid out as a 2×2
 * grid of category blocks, each with its cards.
 *
 * Sales is measured differently on purpose: the sheet tracks clicks and spend
 * for it rather than leads, so its cards report clicks and cost per click.
 * Awards.info additionally carries a stricter "quality leads" pair of cards.
 */
export function MarketingDashboard({
  categories,
  asOf,
  pinned = false,
  live = false,
  weekLabel,
  weekNote,
  warnings = [],
}: MarketingDashboardProps) {
  const asOfDay = toEpochDay(asOf);
  const start = weekStart(asOfDay);
  const businessDaysElapsed = Math.min(
    BUSINESS_DAYS_PER_WEEK,
    Math.max(0, Math.round(((asOfDay - start + 1) / 7) * BUSINESS_DAYS_PER_WEEK)),
  );
  const weekText = weekLabel ?? formatWeekRange(fromEpochDay(start), fromEpochDay(weekEnd(asOfDay)));
  const subtitle = `${weekText} · ${businessDaysElapsed} of ${BUSINESS_DAYS_PER_WEEK} business days elapsed`;

  const notices: string[] = [];
  if (pinned) notices.push(`Pinned week — showing ${weekLabel ?? asOf}, not the current one.`);
  if (weekNote) notices.push(weekNote);
  notices.push(
    live
      ? "Live from the Weekly Overall Report. Only the targets are invented."
      : "No marketing sheet connected — no figures available.",
  );
  notices.push(...warnings);
  const hasNotice = pinned || !!weekNote || !live || warnings.length > 0;

  return (
    <section
      className={`${styles.panel} ${titleFont.variable}`}
      data-fullscreen="true"
      data-notice={hasNotice ? "yes" : "no"}
      data-regional="true"
      data-marketing="true"
    >
      <div className={styles.regionList}>
        {categories.map((category) => (
          <CategoryRow key={category.key} category={category} asOfDay={asOfDay} />
        ))}
        <SpendBar
          title={"Paid leads and cost\nper lead by category"}
          subtitle={subtitle}
          categories={categories}
          notices={hasNotice ? notices : []}
        />
      </div>

      <DashboardControls>
        <Link
          href="/dashboard/ceo"
          className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70"
        >
          ← Back
        </Link>
        <RefreshButton className="rounded-lg bg-black/40 px-5 py-3 text-lg text-white hover:bg-black/60 active:bg-black/70 disabled:opacity-60" clearCache={[cachePrefixes.ceoMarketing]} />
      </DashboardControls>
    </section>
  );
}

/** One category: its cards, judged against that category's own targets. */
function CategoryRow({
  category,
  asOfDay,
  headerRight,
}: {
  category: CategoryTotals;
  asOfDay: number;
  /** Rendered at the right of the column header — the notes chip on Awards.info. */
  headerRight?: ReactNode;
}) {
  const isLeads = category.unit === "leads";
  const noun = isLeads ? "leads" : "clicks";

  // The shared marketing thresholds, with this category's own targets.
  const config = {
    ...MARKETING_CONFIG,
    weeklyLeadTarget: category.primaryTarget,
    costPerLeadTarget: category.costTarget,
  };

  // The sheet reports a completed week, so the primary is judged against the
  // whole target rather than a business-day-paced slice of it.
  const primary: LeadsMetric =
    category.primary === null
      ? {
          actual: 0,
          fullTarget: category.primaryTarget,
          pacedTarget: null,
          attainment: null,
          rag: "neutral",
          note: "No data this week",
        }
      : buildLeadsMetric(category.primary, asOfDay, config, false);

  const cost: CostPerLeadMetric =
    category.cost === null
      ? {
          actual: null,
          target: category.costTarget,
          overrun: null,
          spend: 0,
          leads: 0,
          rag: "neutral",
          note: "No data this week",
        }
      : cplMetricFromActual(category.cost, category.spend ?? 0, category.primary ?? 0, config);

  const primarySub = [
    primary.attainment !== null ? `${formatAttainment(primary.attainment)} of target` : "No data this week",
    `Week target ${formatLeads(category.primaryTarget)} ${noun}`,
  ];

  // Awards.info shows its cost cards' donut sideways beside the reading, so the
  // "vs target" line would sit right next to the same figure on the ring — drop it
  // there and keep only the target amount (which the donut doesn't show).
  const costSub =
    category.qualityTarget !== null
      ? [`Target ${formatCostPerLead(category.costTarget)}`]
      : [
          `Target ${formatCostPerLead(category.costTarget)}`,
          cost.overrun !== null ? `${formatSignedPercent(cost.overrun, 1)} vs target` : `Awaiting ${noun}`,
        ];

  // Quality leads are a metric in their own right, not a footnote — they get
  // their own pair of cards, judged against their own targets.
  const hasQuality = category.qualityTarget !== null && category.qualityCostTarget !== null;
  const qualityConfig = hasQuality
    ? {
        ...MARKETING_CONFIG,
        weeklyLeadTarget: category.qualityTarget!,
        costPerLeadTarget: category.qualityCostTarget!,
      }
    : null;

  const quality: LeadsMetric | null = !qualityConfig
    ? null
    : category.qualityLeads === null
      ? {
          actual: 0,
          fullTarget: category.qualityTarget!,
          pacedTarget: null,
          attainment: null,
          rag: "neutral",
          note: "No data this week",
        }
      : buildLeadsMetric(category.qualityLeads, asOfDay, qualityConfig, false);

  const qualityCost: CostPerLeadMetric | null = !qualityConfig
    ? null
    : category.qualityCost === null
      ? {
          actual: null,
          target: category.qualityCostTarget!,
          overrun: null,
          spend: 0,
          leads: 0,
          rag: "neutral",
          note: "No data this week",
        }
      : cplMetricFromActual(category.qualityCost, category.spend ?? 0, category.qualityLeads ?? 0, qualityConfig);

  return (
    <section className={styles.region} data-span={hasQuality ? "true" : undefined}>
      <div className={styles.regionHead}>
        <h2 className={styles.regionLabel}>{category.label}</h2>
        {headerRight}
      </div>
      <div className={styles.regionTopRow} data-cards={quality ? "4" : "2"}>
        <StatTile
          compact
          label={isLeads ? "Paid Leads Generated This Week" : "Clicks Generated This Week"}
          value={formatLeads(primary.actual)}
          rag={primary.rag}
          note={primary.note}
          subLines={primarySub}
        />
        <StatTile
          compact
          label={isLeads ? "Cost Per Lead vs Target" : "Cost Per Click vs Target"}
          value={cost.actual === null ? "—" : formatCostPerLead(cost.actual)}
          rag={cost.rag}
          note={cost.note}
          subLines={costSub}
          chart={<DonutChart ratio={cost.actual === null ? null : cost.actual / cost.target} rag={cost.rag} lowerIsBetter />}
        />

        {quality && qualityCost && qualityConfig && (
          <>
            <StatTile
              compact
              label="Quality Leads This Week"
              value={formatLeads(quality.actual)}
              rag={quality.rag}
              note={quality.note}
              subLines={[
                quality.attainment !== null
                  ? `${formatAttainment(quality.attainment)} of target`
                  : "No data this week",
                `Week target ${formatLeads(category.qualityTarget!)} quality leads`,
              ]}
            />
            <StatTile
              compact
              label="Cost Per Quality Lead vs Target"
              value={qualityCost.actual === null ? "—" : formatCostPerLead(qualityCost.actual)}
              rag={qualityCost.rag}
              note={qualityCost.note}
              subLines={[`Target ${formatCostPerLead(category.qualityCostTarget!)}`]}
              chart={
                <DonutChart
                  ratio={qualityCost.actual === null ? null : qualityCost.actual / qualityCost.target}
                  rag={qualityCost.rag}
                  lowerIsBetter
                />
              }
            />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The card spanning the three lead columns: the dashboard title and week on the
 * left (moved out of a top masthead), and the three categories' weekly ad spend
 * with a total on the right. Awards.info is excluded; it fills its own column.
 */
function SpendBar({
  title,
  subtitle,
  categories,
  notices,
}: {
  title: string;
  subtitle: string;
  categories: CategoryTotals[];
  notices: string[];
}) {
  const total = categories.reduce((sum, c) => sum + (c.spend ?? 0), 0);
  return (
    <section className={`${styles.tile} ${styles.spendBar}`} data-compact="true" data-rag="neutral">
      {notices.length > 0 && (
        <div className={styles.spendNotice}>
          <NoticeChip notices={notices} />
        </div>
      )}
      <div className={styles.spendBarTitle}>
        <h1 className={styles.spendBarHeading}>{title}</h1>
        <div className={styles.week}>{subtitle}</div>
      </div>
      <div className={styles.spendGroup}>
        <div className={styles.tileLabel}>Ad Spent This Week</div>
        <div className={styles.spendCols}>
          {categories.map((c) => (
            <div key={c.key} className={styles.spendItem}>
              <span className={styles.spendItemLabel}>{c.label}</span>
              <span className={styles.spendItemValue}>{fmtSpend(c.spend)}</span>
            </div>
          ))}
          <div className={styles.spendItem} data-total="true">
            <span className={styles.spendItemLabel}>Total</span>
            <span className={styles.spendItemValue}>{fmtSpend(total)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
