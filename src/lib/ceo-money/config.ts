import type { DashboardConfig } from "./types";

// The reporting calendar is shared with every other CEO dashboard.
export { BUSINESS_DAYS_PER_WEEK, TIMEZONE, TREND_WEEKS, WEEK_START_DOW } from "@/lib/ceo/week";

/** Weeks averaged behind the overdue-AR trend comparison. */
export const AR_TRAILING_WEEKS = 4;

export const DEFAULT_CONFIG: DashboardConfig = {
  // SGD per 1 unit. Set once a year so FX drift stays out of performance.
  budgetRates: { SGD: 1, USD: 1.2836, HKD: 0.1646 },

  arWarningGrowth: 0.02,
  arCriticalGrowth: 0.1,
  arGuardrailFraction: 0.25,

  // Green at or above target, yellow 80–99%, red below 80%.
  targetGreenAt: 1.0,
  targetAmberAt: 0.8,

  // Overdue receivables as a share of the cash still owed. Less is better: green
  // at or under 30%, yellow to 50%, red beyond.
  //
  // Set high on purpose. With 30-day terms and invoices batched weekly, a large
  // part of what is outstanding at any moment is legitimately past due and simply
  // being collected — in June 2026 it was 41%, with half of that less than a month
  // past terms. Lines drawn where a naive reading would put them (10%/20%) paint
  // the tile red every week and teach everyone to ignore it.
  overdueGreenAt: 0.3,
  overdueAmberAt: 0.5,
};
