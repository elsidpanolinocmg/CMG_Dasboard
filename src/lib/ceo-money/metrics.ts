import { AR_TRAILING_WEEKS, TREND_WEEKS } from "./config";
import {
  addWeeks,
  fromEpochDay,
  isWithin,
  toEpochDay,
  weekPaceFraction,
  weekStart,
} from "./date";
import {
  bankFeesIn,
  outstandingThisYearIn,
  cashCollectedIn as registerCashIn,
  cashTargetIn,
  excludedIn,
  invoicedSgdIn,
  overdueCountIn,
  overdueReceivablesIn,
  paidCountIn,
  ratesUsedIn,
  type InvoiceRegister,
} from "./invoice-register";
import { toSGD } from "./money";
import type {
  ArHistoryPoint,
  ArMetric,
  DashboardConfig,
  EpochDay,
  Invoice,
  OverdueMetric,
  Payment,
  Rag,
  Target,
  TargetMetric,
  WeekPoint,
} from "./types";

export interface Ledger {
  invoices: Invoice[];
  payments: Payment[];
  targets: Target[];
  config: DashboardConfig;
}

/** Sub-cent noise from float arithmetic should not render as an open balance. */
const EPSILON = 0.005;

/** `draft` has not been issued; `void` never existed. Neither is revenue. */
function isCountable(invoice: Invoice): boolean {
  return invoice.status === "open" || invoice.status === "paid";
}

class LedgerIndex {
  readonly byInvoiceNo = new Map<string, Invoice>();
  readonly paymentsByInvoiceNo = new Map<string, Payment[]>();

  constructor(readonly ledger: Ledger) {
    for (const invoice of ledger.invoices) {
      this.byInvoiceNo.set(invoice.invoiceNo, invoice);
    }
    for (const payment of ledger.payments) {
      const list = this.paymentsByInvoiceNo.get(payment.invoiceNo);
      if (list) list.push(payment);
      else this.paymentsByInvoiceNo.set(payment.invoiceNo, [payment]);
    }
  }

  sgd(amount: number, currency: Invoice["currency"]): number {
    return toSGD(amount, currency, this.ledger.config.budgetRates);
  }

  /**
   * A payment against a void invoice is not a collection. A payment whose
   * invoice we've never seen still moved money, so it counts — but it is
   * reported separately, because it means the sheet is missing a row.
   */
  paymentCounts(payment: Payment): boolean {
    const invoice = this.byInvoiceNo.get(payment.invoiceNo);
    return !invoice || invoice.status !== "void";
  }

  paidAgainst(invoiceNo: string, asOf: EpochDay): number {
    const payments = this.paymentsByInvoiceNo.get(invoiceNo) ?? [];
    let total = 0;
    for (const p of payments) {
      if (toEpochDay(p.paidDate) <= asOf) total += this.sgd(p.amount, p.currency);
    }
    return total;
  }
}

// ---------------------------------------------------------------------------
// Window sums
// ---------------------------------------------------------------------------

/**
 * Revenue invoiced: the gross value of the invoices raised in the window, in
 * SGD. Both ends inclusive. Used only when no register sheet is configured —
 * with one, the figure comes from `invoicedSgdIn` and its own currency column.
 */
export function revenueInvoicedIn(index: LedgerIndex, start: EpochDay, end: EpochDay): number {
  let total = 0;
  for (const invoice of index.ledger.invoices) {
    if (!isCountable(invoice)) continue;
    if (isWithin(invoice.issueDate, start, end)) {
      total += index.sgd(invoice.amount, invoice.currency);
    }
  }
  return total;
}

/** Cash collected = payments received in the window. Both ends inclusive. */
export function cashCollectedIn(index: LedgerIndex, start: EpochDay, end: EpochDay): number {
  let total = 0;
  for (const payment of index.ledger.payments) {
    if (!index.paymentCounts(payment)) continue;
    if (isWithin(payment.paidDate, start, end)) {
      total += index.sgd(payment.amount, payment.currency);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Receivables, reconstructed as of any past date
// ---------------------------------------------------------------------------

/**
 * What was still owed on `asOf`. Because invoices and payments both carry
 * dates, any past date can be reconstructed exactly — the AR trend works from
 * the first day of real data rather than waiting a month for snapshots.
 */
export function overdue30PlusAsOf(index: LedgerIndex, asOf: EpochDay): number {
  let total = 0;

  for (const invoice of index.ledger.invoices) {
    if (!isCountable(invoice)) continue;
    if (toEpochDay(invoice.issueDate) > asOf) continue;
    if (asOf - toEpochDay(invoice.dueDate) <= 30) continue;

    const balance =
      index.sgd(invoice.amount, invoice.currency) - index.paidAgainst(invoice.invoiceNo, asOf);
    if (balance > EPSILON) total += balance;
  }

  return total;
}

// ---------------------------------------------------------------------------
// RAG
// ---------------------------------------------------------------------------

function targetFor(ledger: Ledger, start: EpochDay): Target | undefined {
  const key = fromEpochDay(start);
  return ledger.targets.find((t) => t.periodStart === key);
}

/**
 * Attainment is measured against the target pro-rated by business days elapsed,
 * not the full week's target. On a Friday afternoon a full-week comparison would
 * read 20% and paint the tile red, every week, for reasons that have nothing to
 * do with performance.
 */
export function buildTargetMetric(
  actual: number,
  fullTarget: number | null,
  asOf: EpochDay,
  config: DashboardConfig,
): TargetMetric {
  if (fullTarget === null) {
    return {
      actual,
      fullTarget: null,
      pacedTarget: null,
      attainment: null,
      rag: "neutral",
      note: "No target set",
    };
  }

  const pacedTarget = fullTarget * weekPaceFraction(asOf);
  if (pacedTarget <= 0) {
    return { actual, fullTarget, pacedTarget, attainment: null, rag: "neutral", note: "Week not started" };
  }

  const attainment = actual / pacedTarget;
  const rag: Rag =
    attainment >= config.targetGreenAt ? "good" : attainment >= config.targetAmberAt ? "warning" : "critical";
  const note =
    rag === "good" ? "On or above pace" : rag === "warning" ? "Behind pace" : "Well behind pace";

  return { actual, fullTarget, pacedTarget, attainment, rag, note };
}

/**
 * Cash banked this week against what the week invoiced, net of bank fees.
 *
 * Not pro-rated, unlike the revenue target. Both sides of this comparison are
 * *actuals* for the same week — money in against money billed — so there is no
 * partial goal to accrue toward. Pacing the target by business days elapsed
 * would divide a whole week's collections by a fifth of the week's billing and
 * report 500% on a Friday.
 */
export function buildCashMetric(
  actual: number,
  target: number | null,
  config: DashboardConfig,
): TargetMetric {
  if (target === null || target <= 0) {
    return {
      actual,
      fullTarget: target,
      pacedTarget: null,
      attainment: null,
      rag: "neutral",
      note: target === null ? "No target set" : "Nothing invoiced this week",
    };
  }

  const attainment = actual / target;
  const rag: Rag =
    attainment >= config.targetGreenAt ? "good" : attainment >= config.targetAmberAt ? "warning" : "critical";
  const note =
    rag === "good"
      ? "Banking as fast as billing"
      : rag === "warning"
        ? "Banking behind billing"
        : "Banking well behind billing";

  return { actual, fullTarget: target, pacedTarget: target, attainment, rag, note };
}

/**
 * Overdue receivables against the cash still owed — of the money that has not
 * arrived, how much has gone past terms. Less is better, so the RAG thresholds
 * run the other way from every other tile: a *low* ratio is green.
 */
export function buildOverdueMetric(
  actual: number,
  outstanding: number,
  count: number,
  config: DashboardConfig,
): OverdueMetric {
  if (outstanding <= 0) {
    return { actual, outstanding, ratio: null, count, rag: "neutral", note: "Nothing outstanding" };
  }

  const ratio = actual / outstanding;
  const rag: Rag =
    ratio <= config.overdueGreenAt ? "good" : ratio <= config.overdueAmberAt ? "warning" : "critical";
  const note = rag === "good" ? "Within tolerance" : rag === "warning" ? "Elevated" : "High";

  return { actual, outstanding, ratio, count, rag, note };
}

/**
 * Overdue AR has no target, so it is judged on movement: this week's balance
 * against its own trailing average. A pure trend rule would show green on a
 * balance that is enormous but flat, so an absolute guardrail overrides it —
 * if overdue AR outgrows a quarter of recent collections, it is red regardless.
 */
export function buildArMetric(index: LedgerIndex, asOf: EpochDay): ArMetric {
  const config = index.ledger.config;
  const actual = overdue30PlusAsOf(index, asOf);

  const history: number[] = [];
  for (let i = 1; i <= AR_TRAILING_WEEKS; i++) {
    history.push(overdue30PlusAsOf(index, addWeeks(asOf, -i)));
  }
  const usable = history.filter((v) => v > EPSILON);
  const trailingAverage = usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;

  const quarterCollections = cashCollectedIn(index, asOf - 89, asOf);
  const guardrailTripped =
    quarterCollections > EPSILON && actual > quarterCollections * config.arGuardrailFraction;

  if (guardrailTripped) {
    return {
      actual,
      trailingAverage,
      growth: trailingAverage ? (actual - trailingAverage) / trailingAverage : null,
      rag: "critical",
      note: "Above guardrail",
      guardrailTripped: true,
    };
  }

  if (trailingAverage === null) {
    return {
      actual,
      trailingAverage: null,
      growth: null,
      rag: "neutral",
      note: "No history yet",
      guardrailTripped: false,
    };
  }

  const growth = (actual - trailingAverage) / trailingAverage;
  const rag: Rag =
    growth <= config.arWarningGrowth ? "good" : growth <= config.arCriticalGrowth ? "warning" : "critical";
  const note = rag === "good" ? "Low or stable" : rag === "warning" ? "Rising" : "Materially growing";

  return { actual, trailingAverage, growth, rag, note, guardrailTripped: false };
}

// ---------------------------------------------------------------------------
// Weekly history
//
// Nothing on the dashboard plots these today — the tiles show the current week
// against its target and no trend. They are kept because the AR metric measures
// this week against its own trailing average, which needs the history.
// ---------------------------------------------------------------------------

export function buildWeekSeries(
  index: LedgerIndex,
  asOf: EpochDay,
  register: InvoiceRegister | null,
  weeks = TREND_WEEKS,
): WeekPoint[] {
  const current = weekStart(asOf);
  const points: WeekPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = addWeeks(current, -i);
    const end = start + 6;
    // The in-flight week is only measured up to today, or it would read as a collapse.
    const windowEnd = Math.min(end, asOf);
    const target = targetFor(index.ledger, start);

    points.push({
      weekStart: fromEpochDay(start),
      weekEnd: fromEpochDay(end),
      cash: cashCollectedIn(index, start, windowEnd),
      revenue: register
        ? invoicedSgdIn(register, start, windowEnd)
        : revenueInvoicedIn(index, start, windowEnd),
      cashTarget: target?.cashTarget ?? null,
      revenueTarget: target?.revenueTarget ?? null,
    });
  }
  return points;
}

export function buildArHistory(index: LedgerIndex, asOf: EpochDay, weeks = TREND_WEEKS): ArHistoryPoint[] {
  const currentWeekEnd = weekStart(asOf) + 6;
  const points: ArHistoryPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    // Measure each past week at its Thursday close; the live week at today.
    const at = Math.min(addWeeks(currentWeekEnd, -i), asOf);
    points.push({ asOf: fromEpochDay(at), overdue30Plus: overdue30PlusAsOf(index, at) });
  }
  return points;
}

// ---------------------------------------------------------------------------
// The whole dashboard, computed once on the server
// ---------------------------------------------------------------------------

export interface DashboardData {
  asOf: string;
  weekStart: string;
  weekEnd: string;
  businessDayFraction: number;
  cash: TargetMetric;
  /** The SGD value of the invoices raised this week. */
  revenue: TargetMetric;
  ar: ArMetric;
  /** Overdue receivables from the register. Null on the sample path. */
  overdue: OverdueMetric | null;
  weeks: WeekPoint[];
  arHistory: ArHistoryPoint[];
  unmatchedPayments: number;
  /** Rows in the week left out of `revenue` because they were cancelled or credit-noted. */
  revenueExcluded: { rows: number; sgd: number };
  /** The non-SGD rates the week actually used, e.g. [["USD", 1.35], ["AUD", 0.88]]. */
  ratesUsed: Array<[string, number]>;
  /** Bank transfer fees the week lost in transit: invoiced less credited, on paid invoices. */
  bankFees: number;
  /** How many of the week's invoices have been paid. */
  paidCount: number;
}

/**
 * `register` is the real invoice register, when one is configured. It supplies
 * the invoices-issued count and nothing else; cash and receivables come from the
 * ledger, which has the payment columns the count does not need.
 */
export function buildDashboard(
  ledger: Ledger,
  asOfDate: string,
  register: InvoiceRegister | null = null,
): DashboardData {
  const index = new LedgerIndex(ledger);
  const asOf = toEpochDay(asOfDate);
  const start = weekStart(asOf);
  const target = targetFor(ledger, start);

  const unmatchedPayments = ledger.payments.filter((p) => !index.byInvoiceNo.has(p.invoiceNo)).length;

  const invoiced = register
    ? invoicedSgdIn(register, start, asOf)
    : revenueInvoicedIn(index, start, asOf);

  // With a register, cash is column U on the payments that landed this week, and
  // its target is the week's invoiced value less the bank fees — money banked
  // against money billed. See `cashTargetIn`.
  const cashActual = register
    ? registerCashIn(register, start, asOf)
    : cashCollectedIn(index, start, asOf);
  const cashTarget = register ? cashTargetIn(register, start, asOf) : (target?.cashTarget ?? null);

  return {
    asOf: asOfDate,
    weekStart: fromEpochDay(start),
    weekEnd: fromEpochDay(start + 6),
    businessDayFraction: weekPaceFraction(asOf),
    cash: register
      ? buildCashMetric(cashActual, cashTarget, ledger.config)
      : buildTargetMetric(cashActual, cashTarget, asOf, ledger.config),
    revenue: buildTargetMetric(invoiced, target?.revenueTarget ?? null, asOf, ledger.config),
    ar: buildArMetric(index, asOf),
    overdue: register
      ? buildOverdueMetric(
          overdueReceivablesIn(register, asOf),
          outstandingThisYearIn(register, asOf),
          overdueCountIn(register, asOf),
          ledger.config,
        )
      : null,
    weeks: buildWeekSeries(index, asOf, register),
    arHistory: buildArHistory(index, asOf),
    unmatchedPayments,
    revenueExcluded: register ? excludedIn(register, start, asOf) : { rows: 0, sgd: 0 },
    ratesUsed: register ? ratesUsedIn(register, start, asOf) : [],
    bankFees: register ? bankFeesIn(register, start, asOf) : 0,
    paidCount: register ? paidCountIn(register, start, asOf) : 0,
  };
}

export { LedgerIndex };

// ---------------------------------------------------------------------------
// Per-region dashboard — computed from an invoice register alone
// ---------------------------------------------------------------------------

/**
 * One region's three tiles. Unlike `DashboardData` this needs no sample ledger:
 * every figure comes from the register and a passed-in revenue target, so it can
 * be computed once per region and rendered as its own row of cards.
 */
export interface RegionDashboard {
  asOf: string;
  weekStart: string;
  weekEnd: string;
  businessDayFraction: number;
  /** SGD invoiced this week, against the region's target. */
  revenue: TargetMetric;
  /** Cash banked this week, against what was invoiced net of fees. */
  cash: TargetMetric;
  /** Overdue receivables against the cash still owed. */
  overdue: OverdueMetric;
  bankFees: number;
  paidCount: number;
  ratesUsed: Array<[string, number]>;
  revenueExcluded: { rows: number; sgd: number };
  warnings: string[];
}

export function buildRegionDashboard(
  register: InvoiceRegister,
  asOfDate: string,
  config: DashboardConfig,
  revenueTarget: number,
): RegionDashboard {
  const asOf = toEpochDay(asOfDate);
  const start = weekStart(asOf);

  // A region that invoiced nothing this week is not failing its target — it is a
  // quiet week (or, for a low-volume region, an ordinary one). Show it neutral
  // rather than red, so an empty region does not read as a collapse.
  const invoiced = invoicedSgdIn(register, start, asOf);
  const revenue: TargetMetric =
    invoiced === 0
      ? {
          actual: 0,
          fullTarget: revenueTarget,
          pacedTarget: null,
          attainment: null,
          rag: "neutral",
          note: "No invoices this week",
        }
      : buildTargetMetric(invoiced, revenueTarget, asOf, config);

  return {
    asOf: asOfDate,
    weekStart: fromEpochDay(start),
    weekEnd: fromEpochDay(start + 6),
    businessDayFraction: weekPaceFraction(asOf),
    revenue,
    cash: buildCashMetric(
      registerCashIn(register, start, asOf),
      cashTargetIn(register, start, asOf),
      config,
    ),
    overdue: buildOverdueMetric(
      overdueReceivablesIn(register, asOf),
      outstandingThisYearIn(register, asOf),
      overdueCountIn(register, asOf),
      config,
    ),
    bankFees: bankFeesIn(register, start, asOf),
    paidCount: paidCountIn(register, start, asOf),
    ratesUsed: ratesUsedIn(register, start, asOf),
    revenueExcluded: excludedIn(register, start, asOf),
    warnings: register.warnings,
  };
}
