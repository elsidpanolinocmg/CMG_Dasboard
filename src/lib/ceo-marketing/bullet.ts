import { ascendingBullet, descendingBullet, type Bullet } from "@/lib/ceo/bullet";
import type { CostPerLeadMetric, LeadsMetric, MarketingConfig } from "./types";

const LEADS_HEADROOM = 1.25;
const CPL_HEADROOM = 1.35;

/**
 * Leads: more is better. The marker is the *paced* target, matching what the
 * tile's percentage is measured against — not the full week's target.
 */
export function buildLeadsBullet(metric: LeadsMetric, config: MarketingConfig): Bullet | null {
  if (metric.pacedTarget === null) return null;

  return ascendingBullet({
    value: metric.actual,
    reference: metric.pacedTarget,
    referenceLabel: "pace",
    amberAt: config.leadsAmberAt,
    greenAt: config.leadsGreenAt,
    headroom: LEADS_HEADROOM,
  });
}

/**
 * Cost per lead: less is better, and the reference is the target itself rather
 * than a pace. Spend and leads accrue together, so the ratio is comparable from
 * the first day of the week — there is nothing to pro-rate.
 */
export function buildCostPerLeadBullet(
  metric: CostPerLeadMetric,
  config: MarketingConfig,
): Bullet | null {
  if (metric.actual === null) return null;

  return descendingBullet({
    value: metric.actual,
    reference: metric.target,
    referenceLabel: "target",
    warnAt: 1 + config.cplWarningOverrun,
    critAt: 1 + config.cplCriticalOverrun,
    headroom: CPL_HEADROOM,
  });
}
