import type { BudgetRates, Currency } from "./types";

/**
 * Everything on the dashboard is denominated in SGD, converted at the fixed
 * budget rates in `config.ts` rather than at spot. A CEO tile should move when
 * the business moves, not when the currency market does.
 */
export function toSGD(amount: number, currency: Currency, rates: BudgetRates): number {
  const rate = rates[currency];
  if (rate === undefined) throw new Error(`No budget rate for ${currency}`);
  return amount * rate;
}

/** `S$1.24M` / `S$312K` / `S$840` — for stat-tile values and axis ticks. */
export function formatCompactSGD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}S$${(abs / 1_000_000).toFixed(2)}M`;
  // Round first, then re-test: a value just under a million rounds to 1000
  // thousands, and "S$1000K" is not how anyone writes a million.
  const thousands = Math.round(abs / 1_000);
  if (thousands >= 1_000) return `${sign}S$${(thousands / 1_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}S$${thousands}K`;
  return `${sign}S$${Math.round(abs)}`;
}

/** `S$1,243,918` — for tables, where the exact figure is the point. */
export function formatFullSGD(amount: number): string {
  return `S$${Math.round(amount).toLocaleString("en-SG")}`;
}

/**
 * `S$142.50` — to the cent, for small figures where rounding away the cents
 * would round away the whole point. Bank transfer fees run to single dollars.
 */
export function formatCentsSGD(amount: number): string {
  return `S$${amount.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export { formatPercent, formatSignedPercent } from "@/lib/ceo/format";
