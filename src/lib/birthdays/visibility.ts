import * as pageSettings from "@/lib/repos/pageSettings";

const SETTINGS_KEY = "birthday/visibility";
const SETTINGS_LABEL = "Birthday slide visibility";

/**
 * The full list of pages where a birthday slide *can* appear, with the labels
 * shown in the admin UI. Order matters — this is the order the admin sees them.
 */
export const BIRTHDAY_PAGE_KEYS: { key: string; label: string }[] = [
  // Department landings + brand drill-in (default-on)
  { key: "dashboard/awards", label: "Awards landing (/dashboard/awards)" },
  { key: "dashboard/bizzcon", label: "Bizzcon landing (/dashboard/bizzcon)" },
  { key: "dashboard/editorial", label: "Editorial rotating dashboard (/dashboard/editorial)" },
  { key: "dashboard/[brand]", label: "Single brand pages (/dashboard/<brand>)" },
  // Leaderboards
  { key: "dashboard/awards/leaderboard", label: "Awards leaderboard" },
  { key: "dashboard/awards/total-sales", label: "Awards total sales (hidden page)" },
  { key: "dashboard/bizzcon/leaderboard", label: "Bizzcon leaderboard" },
  { key: "dashboard/editorial/leaderboard", label: "Editorial leaderboard" },
  { key: "dashboard/mailchimp", label: "Mailchimp dashboard" },
  // Shorts
  { key: "dashboard/awards/shorts", label: "Awards shorts" },
  { key: "dashboard/bizzcon/shorts", label: "Bizzcon shorts" },
  { key: "dashboard/editorial/shorts", label: "Editorial shorts" },
  // Videos
  { key: "dashboard/awards/videos", label: "Awards videos" },
  { key: "dashboard/bizzcon/videos", label: "Bizzcon videos" },
  { key: "dashboard/editorial/videos", label: "Editorial videos" },
];

/**
 * Default-enabled pages when the admin has never saved a setting. Per product
 * intent: birthday slides should only appear on the three department landings
 * unless an admin explicitly enables them elsewhere.
 */
export const BIRTHDAY_DEFAULT_ENABLED: string[] = [
  "dashboard/awards",
  "dashboard/bizzcon",
  "dashboard/editorial",
];

const ALLOWED_KEYS = new Set(BIRTHDAY_PAGE_KEYS.map((p) => p.key));

export async function getEnabledPages(): Promise<Set<string>> {
  const saved = await pageSettings.findByKey(SETTINGS_KEY);
  const raw = (saved?.settings as { enabledPageKeys?: unknown } | undefined)
    ?.enabledPageKeys;
  if (!Array.isArray(raw)) {
    return new Set(BIRTHDAY_DEFAULT_ENABLED);
  }
  // Filter to known keys only — drops any stale entries from old config.
  return new Set(
    (raw as unknown[]).filter(
      (k): k is string => typeof k === "string" && ALLOWED_KEYS.has(k),
    ),
  );
}

export async function isPageEnabled(pageKey: string): Promise<boolean> {
  const enabled = await getEnabledPages();
  return enabled.has(pageKey);
}

export async function saveEnabledPages(keys: string[]): Promise<void> {
  // Validate input — drop unknown keys silently.
  const filtered = keys.filter((k) => ALLOWED_KEYS.has(k));
  await pageSettings.upsert({
    pageKey: SETTINGS_KEY,
    label: SETTINGS_LABEL,
    settings: { enabledPageKeys: filtered },
  });
}
