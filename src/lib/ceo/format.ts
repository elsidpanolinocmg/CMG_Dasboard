/** `1,240` — a count of things. Never carries a currency symbol. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-SG");
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/**
 * Attainment against a target, truncated rather than rounded: `99%`, not `100%`,
 * for 99.98% of pace.
 *
 * Rounding would let the figure claim a threshold the value has not crossed. A
 * week that lands a hair under its target — say 99.98% of the way there — is
 * still short, and the tile beside it is yellow and says "Behind pace" because
 * the RAG rule tests the true ratio. Printing "100% of pace" next to that badge
 * makes the dashboard argue with itself, and the reader has no way to tell which
 * half is wrong.
 *
 * Truncating is the conservative direction: the number can under-state progress
 * by less than a point, but it can never overstate it across the line that
 * decides the colour.
 */
export function formatAttainment(fraction: number): string {
  const percent = fraction * 100;
  const truncated = percent < 0 ? Math.ceil(percent) : Math.floor(percent);
  return `${truncated}%`;
}

export function formatSignedPercent(fraction: number, digits = 0): string {
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(digits)}%`;
}
