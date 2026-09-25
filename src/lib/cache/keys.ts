export const cacheKeys = {
  activeNow: (brand: string) => `ga4:active-now:${brand}`,
  activeWindow: (brand: string, days: number) => `ga4:active:${days}d:${brand}`,
  allActive: () => `ga4:all-active`,
  videosByDepartment: (dept: string, format: string) =>
    `vimeo:videos:${dept}:${format}`,
  videosByBrand: (brand: string) => `vimeo:videos:brand:${brand}`,
  videosAll: () => `vimeo:videos:all`,
  awardsByBrand: (brand: string) => `awards:brand:${brand}`,
  awardsAll: () => `awards:all`,
  awardsLeaderboard: () => `awards:leaderboard`,
  awardsList: () => `awards:list`,
  bizzconByBrand: (brand: string) => `bizzcon:brand:${brand}`,
  bizzconAll: () => `bizzcon:all`,
  bizzconEvents: () => `bizzcon:events`,
  bizzconLeaderboard: () => `bizzcon:leaderboard`,
  sponsorshipSheet: () => `bizzcon:sponsorship`,
  editorialPageviews: (brand: string) => `ga4:editorial:pageviews:${brand}`,
  editorialLeaderboard: (range: string, section: string) =>
    `editorial:leaderboard:${range}:${section || "all"}`,
  drupalAuthors: (brand: string) => `drupal:authors:${brand}`,
  mailchimpSheet: () => `mailchimp:sheet`,
  mailchimpAudiences: () => `mailchimp:audiences`,
  mailchimpEngagement: () => `mailchimp:engagement`,
  mailchimpMovement: (days: number) => `mailchimp:movement:${days}d`,
  mailchimpCampaignReports: (days: number) => `mailchimp:reports:${days}d`,
  // Keyed by date: the sample-data fallback is generated relative to "today",
  // so a cached ledger must not survive a midnight rollover.
  ceoMoneyLedger: (asOf: string) => `ceo-money:ledger:${asOf}`,
  ceoInvoiceRegister: (asOf: string, region: string) => `ceo-money:register:${region}:${asOf}`,
  ceoMarketingLeads: (asOf: string) => `ceo-marketing:leads:${asOf}`,
  // The deliverable trackers word their deadlines relative to today ("due in 3
  // days"), so each day gets its own entry and a cached read never outlives
  // Singapore midnight. The version segment is bumped whenever the cached shape
  // changes (v2: per-card item lists; v3: data notes), so an older copy is never served as new.
  ceoDeliverables: (day: string) => `ceo-deliverables:v3:${day}`,
  ceoVideoInterviews: (day: string) => `ceo-video-interviews:v3:${day}`,
  ceoMagazineMaterials: (day: string) => `ceo-magazine:v3:${day}`,
  ceoShortFormVideos: (day: string) => `ceo-sfv:v3:${day}`,
  // The last successful read of a CEO board, kept long after its cache entry
  // expires so a failed read can fall back to it. A separate "last-good:" prefix
  // means clearing a board's cache (the Refresh button) never deletes it.
  lastGood: (name: string) => `last-good:${name}`,
} as const;

export const cachePrefixes = {
  ga4: "ga4:",
  vimeo: "vimeo:",
  awards: "awards:",
  bizzcon: "bizzcon:",
  editorial: "editorial:",
  drupal: "drupal:",
  mailchimp: "mailchimp:",
  ceoMoney: "ceo-money:",
  ceoMarketing: "ceo-marketing:",
  ceoDeliverables: "ceo-deliverables:",
  ceoVideoInterviews: "ceo-video-interviews:",
  ceoMagazineMaterials: "ceo-magazine:",
  ceoShortFormVideos: "ceo-sfv:",
} as const;
