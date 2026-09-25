/**
 * Helpers for the "notes on this data" a CEO board shows about its sheet — rows it
 * had to skip or couldn't fully read — worded so the team can find and fix them.
 */

/** "1 row" / "3 rows". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Sheet row numbers, kept short: "row 23", "rows 23, 41, 57 and 4 more". */
export function rowList(rows: number[], max = 5): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const shown = sorted.slice(0, max).join(", ");
  const more = sorted.length > max ? ` and ${sorted.length - max} more` : "";
  return `${sorted.length === 1 ? "row" : "rows"} ${shown}${more}`;
}

/** A few quoted examples, long ones shortened: `"A", "B", "C" and 2 more`. */
export function someOf(values: string[], max = 3): string {
  const unique = [...new Set(values)];
  const shown = unique
    .slice(0, max)
    .map((v) => `"${v.length > 40 ? `${v.slice(0, 39).trimEnd()}…` : v}"`)
    .join(", ");
  return unique.length > max ? `${shown} and ${unique.length - max} more` : shown;
}

/** A client cell that holds a date ("April 3", "3 Apr") — usually a stray entry. */
export function looksLikeDate(text: string): boolean {
  const month = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  return new RegExp(`^(${month}\\s+\\d{1,2}|\\d{1,2}\\s+${month})$`, "i").test(text.trim());
}
