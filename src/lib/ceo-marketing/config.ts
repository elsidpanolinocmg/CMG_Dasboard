import type { MarketingConfig } from "./types";

/**
 * The targets below are INVENTED. Nothing is wired to an ad platform yet, so
 * every figure on the marketing dashboard is generated. Replace these with the
 * real weekly lead goal and cost-per-lead target before anyone acts on a colour.
 */
export const MARKETING_CONFIG: MarketingConfig = {
  /** Paid leads the week is expected to produce. */
  weeklyLeadTarget: 120,

  /** Blended cost per paid lead, in SGD. */
  costPerLeadTarget: 45,

  // Leads: green at or above the paced target, yellow within 15% of it, red below.
  leadsGreenAt: 1.0,
  leadsAmberAt: 0.85,

  // Cost per lead: green at or below target, yellow up to 15% over, red beyond.
  cplWarningOverrun: 0,
  cplCriticalOverrun: 0.15,
};
