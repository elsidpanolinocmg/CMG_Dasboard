import type { BudgetRates, Currency } from "./types";

/**
 * Converts an amount at the fixed budget rates rather than at spot. A CEO tile
 * should move when the business moves, not when the currency market does. (The
 * dashboard now reports in USD; the invoice register rebases its rates to USD,
 * so most invoices — already billed in USD — pass through 1:1.)
 */
export function toSGD(amount: number, currency: Currency, rates: BudgetRates): number {
  const rate = rates[currency];
  if (rate === undefined) throw new Error(`No budget rate for ${currency}`);
  return amount * rate;
}

/** `$1.24M` / `$312K` / `$840` — for stat-tile values and axis ticks. */
export function formatCompactUSD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  // Round first, then re-test: a value just under a million rounds to 1000
  // thousands, and "$1000K" is not how anyone writes a million.
  const thousands = Math.round(abs / 1_000);
  if (thousands >= 1_000) return `${sign}$${(thousands / 1_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${thousands}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** `$1,243,918` — for tables, where the exact figure is the point. */
export function formatFullUSD(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/**
 * `$142.50` — to the cent, for small figures where rounding away the cents
 * would round away the whole point. Bank transfer fees run to single dollars.
 */
export function formatCentsUSD(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export { formatPercent, formatSignedPercent } from "@/lib/ceo/format";
