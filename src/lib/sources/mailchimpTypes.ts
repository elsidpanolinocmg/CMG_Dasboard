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
