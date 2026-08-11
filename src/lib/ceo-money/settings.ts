import * as pageSettings from "@/lib/repos/pageSettings";

import { DEFAULT_CONFIG } from "./config";
import { DEFAULT_RATES, loadRates } from "./invoice-register";
import type { DashboardConfig } from "./types";

/** The page-settings key the CEO money dashboards read. */
export const CEO_MONEY_PAGE_KEY = "dashboard/ceo/money";

/**
 * Currencies the register may contain. SGD is the reporting currency and is
 * always 1, so it is not editable.
 */
export const EDITABLE_CURRENCIES = ["USD", "HKD", "AUD", "GBP", "EUR"] as const;

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Thresholds are stored as whole percentages because that is how they are read
 * on the page ("green at 30%"), while the dashboard works in fractions.
 */
function percent(v: unknown, fallback: number): number {
  const n = num(v);
  return n === null ? fallback : n / 100;
}

export interface CeoMoneySettings {
  config: DashboardConfig;
  rates: Record<string, number>;
}

/**
 * Merges the admin panel's page settings over the built-in defaults.
 *
 * Anything left blank keeps its default, and a settings-store failure falls
 * back to the defaults entirely — the money dashboards must not go dark
 * because a threshold could not be read.
 */
export async function loadCeoMoneySettings(): Promise<CeoMoneySettings> {
  const envRates = loadRates();
  const fallback: CeoMoneySettings = { config: DEFAULT_CONFIG, rates: envRates };

  let stored: Record<string, unknown>;
  try {
    const doc = await pageSettings.findByKey(CEO_MONEY_PAGE_KEY);
    if (!doc?.settings) return fallback;
    stored = doc.settings as Record<string, unknown>;
  } catch {
    return fallback;
  }

  const rates: Record<string, number> = { ...envRates };
  for (const code of EDITABLE_CURRENCIES) {
    const v = num(stored[`rate${code}`]);
    if (v !== null && v > 0) rates[code] = v;
  }
  // SGD is the reporting currency by definition; letting it drift would
  // silently rescale every figure on the page.
  rates.SGD = 1;

  return {
    rates,
    config: {
      ...DEFAULT_CONFIG,
      budgetRates: {
        SGD: 1,
        USD: rates.USD ?? DEFAULT_CONFIG.budgetRates.USD,
        HKD: rates.HKD ?? DEFAULT_CONFIG.budgetRates.HKD,
      },
      targetGreenAt: percent(stored.targetGreenAtPercent, DEFAULT_CONFIG.targetGreenAt),
      targetAmberAt: percent(stored.targetAmberAtPercent, DEFAULT_CONFIG.targetAmberAt),
      overdueGreenAt: percent(stored.overdueGreenAtPercent, DEFAULT_CONFIG.overdueGreenAt),
      overdueAmberAt: percent(stored.overdueAmberAtPercent, DEFAULT_CONFIG.overdueAmberAt),
      arWarningGrowth: percent(stored.arWarningGrowthPercent, DEFAULT_CONFIG.arWarningGrowth),
      arCriticalGrowth: percent(stored.arCriticalGrowthPercent, DEFAULT_CONFIG.arCriticalGrowth),
      arGuardrailFraction: percent(
        stored.arGuardrailFractionPercent,
        DEFAULT_CONFIG.arGuardrailFraction,
      ),
    },
  };
}

/** Defaults as whole percentages, for the admin form. */
export const THRESHOLD_DEFAULTS = {
  targetGreenAtPercent: DEFAULT_CONFIG.targetGreenAt * 100,
  targetAmberAtPercent: DEFAULT_CONFIG.targetAmberAt * 100,
  overdueGreenAtPercent: DEFAULT_CONFIG.overdueGreenAt * 100,
  overdueAmberAtPercent: DEFAULT_CONFIG.overdueAmberAt * 100,
  arWarningGrowthPercent: DEFAULT_CONFIG.arWarningGrowth * 100,
  arCriticalGrowthPercent: DEFAULT_CONFIG.arCriticalGrowth * 100,
  arGuardrailFractionPercent: DEFAULT_CONFIG.arGuardrailFraction * 100,
} as const;

export const RATE_DEFAULTS = DEFAULT_RATES;
