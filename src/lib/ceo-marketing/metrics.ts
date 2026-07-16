import { formatPercent } from "@/lib/ceo/format";
import type { Rag } from "@/lib/ceo/rag";
import {
  addWeeks,
  fromEpochDay,
  isWithin,
  toEpochDay,
  TREND_WEEKS,
  weekPaceFraction,
  weekStart,
  type EpochDay,
} from "@/lib/ceo/week";
import type {
  CostPerLeadMetric,
  LeadLedger,
  LeadsMetric,
  MarketingConfig,
  MarketingWeekPoint,
} from "./types";

/** Leads and spend inside a window. Both ends inclusive. */
export function totalsIn(ledger: LeadLedger, start: EpochDay, end: EpochDay) {
  let leads = 0;
  let spend = 0;
  for (const day of ledger.days) {
    if (isWithin(day.date, start, end)) {
      leads += day.leads;
      spend += day.spend;
    }
  }
  return { leads, spend };
}

/**
 * Attainment is measured against the target pro-rated by business days elapsed,
 * not the full week's target. On a Friday afternoon a full-week comparison would
 * read 20% and paint the tile red, every week, for reasons that have nothing to
 * do with performance.
 *
 * `paced` is false when the actual is a completed weekly figure — the sheet
 * reports leads a full week at a time, so there is no partial week to pace
 * against, and the comparison is against the whole target.
 */
export function buildLeadsMetric(
  actual: number,
  asOf: EpochDay,
  config: MarketingConfig,
  paced = true,
): LeadsMetric {
  const fullTarget = config.weeklyLeadTarget;
  const pacedTarget = paced ? fullTarget * weekPaceFraction(asOf) : fullTarget;

  if (pacedTarget <= 0) {
    return { actual, fullTarget, pacedTarget, attainment: null, rag: "neutral", note: "Week not started" };
  }

  const attainment = actual / pacedTarget;
  const rag: Rag =
    attainment >= config.leadsGreenAt ? "good" : attainment >= config.leadsAmberAt ? "warning" : "critical";
  const note = rag === "good" ? "Hit target" : rag === "warning" ? "Near target" : "Off pace";

  return { actual, fullTarget, pacedTarget, attainment, rag, note };
}

/**
 * Cost per lead is a ratio, so it needs no pacing — but it does need leads. A
 * week that has spent money and produced nothing has no cost per lead to state,
 * and reporting that as a green zero would be the worst possible reading.
 */
export function buildCostPerLeadMetric(
  spend: number,
  leads: number,
  config: MarketingConfig,
): CostPerLeadMetric {
  const target = config.costPerLeadTarget;

  if (leads <= 0) {
    return {
      actual: null,
      target,
      overrun: null,
      spend,
      leads,
      rag: "neutral",
      note: spend > 0 ? "Spend, but no leads yet" : "No leads yet",
    };
  }

  return cplMetricFromActual(spend / leads, spend, leads, config);
}

/**
 * A cost-per-lead metric from an already-computed CPL — used when the sheet
 * supplies its own CPL figure (an average of the sections' rates) rather than a
 * spend and a lead count to divide.
 */
export function cplMetricFromActual(
  actual: number,
  spend: number,
  leads: number,
  config: MarketingConfig,
): CostPerLeadMetric {
  const target = config.costPerLeadTarget;
  const overrun = (actual - target) / target;

  const rag: Rag =
    overrun <= config.cplWarningOverrun
      ? "good"
      : overrun <= config.cplCriticalOverrun
        ? "warning"
        : "critical";

  const ceiling = formatPercent(config.cplCriticalOverrun);
  const note =
    rag === "good"
      ? "On or below target"
      : rag === "warning"
        ? `Up to ${ceiling} over`
        : `${ceiling}+ over target`;

  return { actual, target, overrun, spend, leads, rag, note };
}

export function buildWeekSeries(
  ledger: LeadLedger,
  asOf: EpochDay,
  weeks = TREND_WEEKS,
): MarketingWeekPoint[] {
  const current = weekStart(asOf);
  const points: MarketingWeekPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = addWeeks(current, -i);
    const end = start + 6;
    // The in-flight week is only measured up to today, or it would read as a collapse.
    const { leads, spend } = totalsIn(ledger, start, Math.min(end, asOf));

    points.push({
      weekStart: fromEpochDay(start),
      weekEnd: fromEpochDay(end),
      leads,
      spend,
      costPerLead: leads > 0 ? spend / leads : null,
    });
  }
  return points;
}

export interface MarketingData {
  asOf: string;
  weekStart: string;
  weekEnd: string;
  businessDayFraction: number;
  leads: LeadsMetric;
  costPerLead: CostPerLeadMetric;
  weeks: MarketingWeekPoint[];
}

/**
 * `leadsOverride` carries real leads from the weekly sheet:
 *   · a number → that week's leads, compared against the full weekly target
 *   · null     → the sheet is the source but has no block for this week yet
 *   · undefined → no sheet; leads come from the sample ledger like everything else
 *
 * Cost per lead always comes from the sample ledger for now — the sheet's spend
 * definition is not yet settled, so only the leads tile goes live.
 */
export function buildMarketingDashboard(
  ledger: LeadLedger,
  asOfDate: string,
  leadsOverride?: number | null,
  cplOverride?: number | null,
): MarketingData {
  const asOf = toEpochDay(asOfDate);
  const start = weekStart(asOf);
  const { leads, spend } = totalsIn(ledger, start, asOf);

  let leadsMetric: LeadsMetric;
  if (leadsOverride === undefined) {
    leadsMetric = buildLeadsMetric(leads, asOf, ledger.config);
  } else if (leadsOverride === null) {
    leadsMetric = {
      actual: 0,
      fullTarget: ledger.config.weeklyLeadTarget,
      pacedTarget: null,
      attainment: null,
      rag: "neutral",
      note: "No data this week",
    };
  } else {
    // A completed weekly figure from the sheet: compare against the full target.
    leadsMetric = buildLeadsMetric(leadsOverride, asOf, ledger.config, false);
  }

  let cplMetric: CostPerLeadMetric;
  if (cplOverride === undefined) {
    cplMetric = buildCostPerLeadMetric(spend, leads, ledger.config);
  } else if (cplOverride === null) {
    cplMetric = {
      actual: null,
      target: ledger.config.costPerLeadTarget,
      overrun: null,
      spend: 0,
      leads: 0,
      rag: "neutral",
      note: "No data this week",
    };
  } else {
    cplMetric = cplMetricFromActual(cplOverride, 0, leadsOverride ?? 0, ledger.config);
  }

  return {
    asOf: asOfDate,
    weekStart: fromEpochDay(start),
    weekEnd: fromEpochDay(start + 6),
    businessDayFraction: weekPaceFraction(asOf),
    leads: leadsMetric,
    costPerLead: cplMetric,
    weeks: buildWeekSeries(ledger, asOf),
  };
}
