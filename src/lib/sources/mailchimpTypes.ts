// Shared types and constants for Mailchimp data — safe to import from client
// components. Do NOT add `import "server-only"` here. Server-only fetchers
// live in `./mailchimp.ts`.

export type MailchimpAudienceStats = {
  title: string;
  listId: string;
  server: string;
  listName: string | null;
  memberCount: number;
  unsubscribeCount: number;
  cleanedCount: number;
  totalContacts: number;
  // Lifetime average across campaigns sent to this audience, already in percent
  // units (e.g. 18.5 means 18.5%). Mailchimp returns it pre-scaled — do not × 100.
  openRate: number | null;
  clickRate: number | null;
  // Derived: lifetime unsubscribe count / (members + unsubscribes), in percent.
  unsubscribeRate: number | null;
  error: string | null;
};

export const LEAD_SOURCE_BUCKETS = [
  "Newsletter sign-up",
  "Awards",
  "Events",
  "Top banks / companies",
  "Paid Ads",
  "Other",
] as const;
export type LeadSourceBucket = (typeof LEAD_SOURCE_BUCKETS)[number];

export type LeadSourceMovement = {
  bucket: LeadSourceBucket;
  subscribed: number;
  unsubscribed: number;
  cleaned: number;
};

export type AudienceMovement = {
  title: string;
  listId: string;
  byBucket: Record<LeadSourceBucket, LeadSourceMovement>;
  totals: { subscribed: number; unsubscribed: number; cleaned: number };
  error: string | null;
};

// Windowed campaign-report aggregates for one audience. Sums campaigns sent
// during the window. All rates are in percent units (e.g. 20.6 = 20.6%).
// Rates are null when sends == 0 so the UI can render "—" instead of 0%.
export type CampaignWindowStats = {
  title: string;
  listId: string;
  campaignsCount: number;
  sends: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number | null;
  clickRate: number | null;
  ctor: number | null;
  error: string | null;
};

/**
 * One audience as written on the stats sheet's "Live Dashboard Data" tab.
 *
 * Every figure is nullable because the sheet genuinely leaves cells empty —
 * a publication with no campaign history has no open rate, and the free
 * Investment Asia account has no monthly cost. Null renders as "—" rather than
 * a zero that would read as a real measurement.
 *
 * Rates are already in percent units (18.5 means 18.5%), matching what the
 * Mailchimp API returns and what the dashboard prints.
 */
export type MailchimpSheetAudience = {
  title: string;
  subscribers: number | null;
  openRate: number | null;
  clickRate: number | null;
  /** Lifetime unsubscribes, as a count. */
  unsubCount: number | null;
  /** Derived from the count: unsubs / (subscribers + unsubs), in percent. */
  unsubRate: number | null;
  /** Movement over the sheet's own reporting window (its Plus7D column). */
  added: number | null;
  unsubscribed: number | null;
  cleaned: number | null;
  net: number | null;
  target: number | null;
  /** As written — "S$282.00", "Free account", or null. */
  monthlyCost: string | null;
  note: string | null;
};

export type MailchimpSheetSnapshot = {
  rows: MailchimpSheetAudience[];
  /** The sheet's own LastChecked stamp: when Mailchimp was actually read. */
  lastChecked: string | null;
  tab: string;
  /** Configuration and layout problems, shown on the page rather than thrown. */
  warnings: string[];
};

/** The sheet's movement columns are a fixed 7-day window. */
export const MAILCHIMP_SHEET_WINDOW_DAYS = 7;
