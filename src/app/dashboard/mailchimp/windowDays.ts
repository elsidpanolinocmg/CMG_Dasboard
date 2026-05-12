export const MAILCHIMP_WINDOW_OPTIONS = [3, 7, 14, 30, 60, 90] as const;
export const DEFAULT_WINDOW_DAYS = 7;

export function parseWindowDays(raw: string | undefined): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) &&
    (MAILCHIMP_WINDOW_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_WINDOW_DAYS;
}
