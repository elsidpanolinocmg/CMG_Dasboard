const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const ttls = {
  ACTIVE_NOW: 60 * SECOND,
  ACTIVE_NOW_STALE: 30 * SECOND,
  ACTIVE_WINDOW: 5 * MINUTE,
  ACTIVE_WINDOW_STALE: 2 * MINUTE,
  VIDEOS: 24 * HOUR,
  VIDEOS_STALE: 1 * HOUR,
  AWARDS: 7 * DAY,
  AWARDS_STALE: 1 * DAY,
  BIZZCON: 7 * DAY,
  BIZZCON_STALE: 1 * DAY,
  LEADERBOARD: 1 * HOUR,
  LEADERBOARD_STALE: 15 * MINUTE,
  SPONSORSHIP: 1 * HOUR,
  SPONSORSHIP_STALE: 15 * MINUTE,
  EDITORIAL_PAGEVIEWS: 1 * HOUR,
  EDITORIAL_PAGEVIEWS_STALE: 15 * MINUTE,
  DRUPAL_AUTHORS: 1 * DAY,
  DRUPAL_AUTHORS_STALE: 1 * HOUR,
  // Subscriber counts refresh daily.
  MAILCHIMP_AUDIENCES: 24 * HOUR,
  MAILCHIMP_AUDIENCES_STALE: 1 * HOUR,
  // Engagement (open/click/unsub rate) refreshes weekly — these are lifetime
  // averages and barely move day-to-day.
  MAILCHIMP_ENGAGEMENT: 7 * DAY,
  MAILCHIMP_ENGAGEMENT_STALE: 1 * DAY,
  // Last-N-days lead-source breakdown refreshes daily.
  MAILCHIMP_MOVEMENT: 24 * HOUR,
  MAILCHIMP_MOVEMENT_STALE: 1 * HOUR,
} as const;
