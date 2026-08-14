import * as pageSettings from "@/lib/repos/pageSettings";

import { loadRates, loadUsdRates } from "./invoice-register";

const PAGE_KEY = "dashboard/ceo/money";

/** Currencies the admin form exposes. SGD is the reporting currency and fixed at 1. */
const EDITABLE = ["USD", "HKD", "AUD", "GBP", "EUR"] as const;

/**
 * Exchange rates for the invoice register, in precedence order: the admin
 * panel's Page settings → CEO · Money, then `CEO_INVOICE_RATES`, then the
 * built-in defaults.
 *
 * Kept apart from `settings.ts` so `invoice-register.ts` can reach it without
 * the two importing each other.
 */
export async function resolveInvoiceRates(): Promise<Record<string, number>> {
  const rates = loadRates();
  try {
    const doc = await pageSettings.findByKey(PAGE_KEY);
    const stored = (doc?.settings ?? {}) as Record<string, unknown>;
    for (const code of EDITABLE) {
      const raw = stored[`rate${code}`];
      const n = typeof raw === "string" ? Number(raw) : raw;
      if (typeof n === "number" && Number.isFinite(n) && n > 0) rates[code] = n;
    }
  } catch {
    // Settings unavailable — the env var and defaults already stand.
  }
  rates.SGD = 1;
  return rates;
}

/** Currencies with a direct →USD override in the admin form. */
const USD_EDITABLE = ["HKD"] as const;

/**
 * Direct currency→USD rates, in precedence order: Page settings → CEO · Money
 * (`usdRate<CODE>`), then `CEO_INVOICE_USD_RATES`, then the built-in defaults.
 * Used in place of the SGD-derived rate where a peg makes the cross inaccurate.
 */
export async function resolveUsdRates(): Promise<Record<string, number>> {
  const rates = loadUsdRates();
  try {
    const doc = await pageSettings.findByKey(PAGE_KEY);
    const stored = (doc?.settings ?? {}) as Record<string, unknown>;
    for (const code of USD_EDITABLE) {
      const raw = stored[`usdRate${code}`];
      const n = typeof raw === "string" ? Number(raw) : raw;
      if (typeof n === "number" && Number.isFinite(n) && n > 0) rates[code] = n;
    }
  } catch {
    // Settings unavailable — the env var and defaults already stand.
  }
  return rates;
}
