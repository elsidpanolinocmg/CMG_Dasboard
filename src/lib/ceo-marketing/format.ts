/** `1,240` — leads are whole things and never carry a currency symbol. */
export function formatLeads(value: number): string {
  return Math.round(value).toLocaleString("en-SG");
}

/**
 * `S$48.62` — cost per lead is small enough that rounding to the dollar would
 * hide the movement the tile exists to show.
 */
export function formatCostPerLead(value: number): string {
  return `S$${value.toFixed(2)}`;
}
