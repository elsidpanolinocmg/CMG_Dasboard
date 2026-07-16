import type { Rag } from "@/lib/ceo/rag";
import type { CivilDate } from "@/lib/ceo/week";

export type { CivilDate, EpochDay } from "@/lib/ceo/week";
export type { Rag } from "@/lib/ceo/rag";

export type Currency = "USD" | "SGD" | "HKD";

/**
 * Only `open` and `paid` invoices carry money: `draft` has not been issued and
 * `void` never existed, so neither contributes to cash or to receivables.
 *
 * The register sheet has its own status vocabulary (UNPAID / PAID / CANCELLED /
 * CREDIT NOTE) and does not use this type.
 */
export type InvoiceStatus = "draft" | "open" | "paid" | "void";

export type PaymentMethod = "bank" | "stripe" | "paypal" | "cash" | "other";

export interface Invoice {
  invoiceNo: string;
  customer: string;
  issueDate: CivilDate;
  dueDate: CivilDate;
  currency: Currency;
  amount: number;
  status: InvoiceStatus;
}

export interface Payment {
  invoiceNo: string;
  paidDate: CivilDate;
  currency: Currency;
  amount: number;
  method: PaymentMethod;
}

/** Both in SGD. Keyed by the Friday that opens the week. */
export interface Target {
  periodStart: CivilDate;
  /** Cash collected: payments that landed. */
  cashTarget: number | null;
  /** Revenue invoiced: the gross value of the invoices raised. */
  revenueTarget: number | null;
}

/** Budget FX rates: units of SGD per 1 unit of the currency. */
export type BudgetRates = Record<Currency, number>;

export interface DashboardConfig {
  budgetRates: BudgetRates;
  /** Overdue AR growth vs its trailing 4-week average. */
  arWarningGrowth: number;
  arCriticalGrowth: number;
  /**
   * Absolute guardrail. If overdue AR exceeds this fraction of trailing
   * 3-month collections, the tile is critical no matter how flat the trend is.
   */
  arGuardrailFraction: number;
  /** Attainment vs the paced target at which a tile turns green. */
  targetGreenAt: number;
  /** Attainment below which a tile turns red rather than yellow. */
  targetAmberAt: number;
  /**
   * Overdue receivables as a fraction of the cash still owed. Less is better, so
   * these run the other way: at or below `green` is good, beyond `amber` is red.
   */
  overdueGreenAt: number;
  overdueAmberAt: number;
}

/** Overdue receivables against the billing they could have come from. Less is better. */
export interface OverdueMetric {
  /** Overdue: unpaid invoices from this year, more than 30 days old. */
  actual: number;
  /** Everything still owed on this year's invoices, overdue or not. */
  outstanding: number;
  /** `actual / outstanding` — the share of missing cash that has gone stale. */
  ratio: number | null;
  /** How many invoices are overdue. */
  count: number;
  rag: Rag;
  note: string;
}

export interface TargetMetric {
  actual: number;
  fullTarget: number | null;
  pacedTarget: number | null;
  attainment: number | null;
  rag: Rag;
  note: string;
}

export interface ArMetric {
  actual: number;
  trailingAverage: number | null;
  growth: number | null;
  rag: Rag;
  note: string;
  guardrailTripped: boolean;
}

export interface WeekPoint {
  weekStart: CivilDate;
  weekEnd: CivilDate;
  /** SGD collected. */
  cash: number;
  /** SGD invoiced. */
  revenue: number;
  cashTarget: number | null;
  revenueTarget: number | null;
}

export interface ArHistoryPoint {
  asOf: CivilDate;
  overdue30Plus: number;
}
