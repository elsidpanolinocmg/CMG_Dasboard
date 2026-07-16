import type { Rag } from "@/lib/ceo/rag";
import type { CivilDate } from "@/lib/ceo/week";

/** One day of paid media: the leads it produced and what they cost. */
export interface DayPoint {
  date: CivilDate;
  leads: number;
  /** Ad spend for the day, in SGD. */
  spend: number;
}

export interface MarketingConfig {
  weeklyLeadTarget: number;
  costPerLeadTarget: number;
  /** Attainment vs the paced lead target at which the tile turns green. */
  leadsGreenAt: number;
  /** Attainment below which the tile turns red rather than yellow. */
  leadsAmberAt: number;
  /** Fraction over the CPL target that is still green. */
  cplWarningOverrun: number;
  /** Fraction over the CPL target beyond which the tile turns red. */
  cplCriticalOverrun: number;
}

export interface LeadLedger {
  days: DayPoint[];
  config: MarketingConfig;
}

export interface LeadsMetric {
  actual: number;
  fullTarget: number;
  /** The week's target pro-rated by business days elapsed. */
  pacedTarget: number | null;
  attainment: number | null;
  rag: Rag;
  note: string;
}

export interface CostPerLeadMetric {
  /** Null when the week has produced no leads: a cost per lead of nothing is not zero. */
  actual: number | null;
  target: number;
  /** Fraction over target. Negative means under, which is good. */
  overrun: number | null;
  spend: number;
  leads: number;
  rag: Rag;
  note: string;
}

export interface MarketingWeekPoint {
  weekStart: CivilDate;
  weekEnd: CivilDate;
  leads: number;
  spend: number;
  costPerLead: number | null;
}
