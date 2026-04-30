import type { Timestamped } from "./common";

/**
 * Per-page configuration for dashboard surfaces (rotation timing, default
 * filter, page size, sound on/off, etc.). The `settings` blob is intentionally
 * untyped so each page can store whatever it needs without schema churn.
 */
export interface PageSetting extends Timestamped {
  pageKey: string; // e.g. "dashboard/bizzcon/leaderboard"
  label?: string;
  settings: Record<string, unknown>;
}
