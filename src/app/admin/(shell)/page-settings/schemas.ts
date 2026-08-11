// Per-page settings schemas. Each entry describes the user-visible form for
// the corresponding page so the admin UI can render typed inputs instead of
// raw JSON. Keys saved in MongoDB match the `key` field on each definition.

export type FieldDef =
  | {
      key: string;
      label: string;
      type: "number";
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      defaultValue?: number;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      defaultValue?: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      defaultValue?: string;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "string";
      defaultValue?: string;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "json";
      defaultValue?: unknown;
      help?: string;
    };

export type PageSchema = {
  label: string;
  fields: FieldDef[];
  // Optional placeholder shown in the collapsible "Advanced (JSON)" section.
  // Lets each page hint at the JSON shape without committing to it as a saved
  // default. The shape is enforced by the page itself, not by the form.
  advancedExample?: unknown;
};

const LEADERBOARD_FIELDS: FieldDef[] = [
  {
    key: "refreshMinutes",
    label: "Auto-refresh interval",
    type: "number",
    min: 1,
    step: 1,
    unit: "minutes",
    defaultValue: 30,
    help: "How often the page silently re-fetches in the background.",
  },
  {
    key: "pageSize",
    label: "Rows per page",
    type: "number",
    min: 1,
    step: 1,
    defaultValue: 10,
  },
  {
    key: "rotationSeconds",
    label: "Page rotation",
    type: "number",
    min: 0,
    step: 1,
    unit: "seconds",
    defaultValue: 15,
    help: "Auto-advance pages on the leaderboard. 0 disables rotation.",
  },
  {
    key: "applyRosterFilter",
    label: "Filter to roster only",
    type: "boolean",
    defaultValue: true,
    help: "Drop sheet rows whose name doesn't match a Person in the department.",
  },
];

const VIDEO_FIELDS: FieldDef[] = [
  {
    key: "tvMode",
    label: "TV mode (kiosk)",
    type: "boolean",
    defaultValue: false,
    help: "Auto-cycle reload, fullscreen-friendly.",
  },
  {
    key: "showTicker",
    label: "Show ticker",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "tickerLimit",
    label: "Ticker item count",
    type: "number",
    min: 1,
    step: 1,
    defaultValue: 20,
  },
];

const SHORTS_FIELDS: FieldDef[] = [
  {
    key: "waitMode",
    label: "Wait mode",
    type: "boolean",
    defaultValue: false,
    help: "Pause between shorts so viewers can read.",
  },
  {
    key: "muted",
    label: "Start muted",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "autoAdvance",
    label: "Auto-advance",
    type: "boolean",
    defaultValue: true,
  },
];

// Thresholds are entered as whole percentages here and divided by 100 where the
// dashboard reads them, because "green at 30%" is how they are actually spoken
// about. Blank means "keep the built-in default".
const CEO_MONEY_FIELDS: FieldDef[] = [
  {
    key: "targetGreenAtPercent",
    label: "Revenue green at",
    type: "number",
    min: 0,
    step: 1,
    unit: "% of target",
    defaultValue: 100,
    help: "At or above this share of the target, the tile is green.",
  },
  {
    key: "targetAmberAtPercent",
    label: "Revenue amber at",
    type: "number",
    min: 0,
    step: 1,
    unit: "% of target",
    defaultValue: 80,
    help: "Below this, the tile turns red.",
  },
  {
    key: "overdueGreenAtPercent",
    label: "Overdue green at or under",
    type: "number",
    min: 0,
    step: 1,
    unit: "% of money owed",
    defaultValue: 30,
    help: "Overdue receivables as a share of everything still owed. Less is better. Set high on purpose — with 30-day terms and weekly invoicing, a large part of what is outstanding is legitimately past due and simply being collected.",
  },
  {
    key: "overdueAmberAtPercent",
    label: "Overdue amber up to",
    type: "number",
    min: 0,
    step: 1,
    unit: "% of money owed",
    defaultValue: 50,
    help: "Beyond this, the tile turns red.",
  },
  {
    key: "arWarningGrowthPercent",
    label: "Overdue growth warning",
    type: "number",
    min: 0,
    step: 0.5,
    unit: "%",
    defaultValue: 2,
    help: "Week-on-week growth in overdue receivables that counts as worth watching.",
  },
  {
    key: "arCriticalGrowthPercent",
    label: "Overdue growth critical",
    type: "number",
    min: 0,
    step: 0.5,
    unit: "%",
    defaultValue: 10,
  },
  {
    key: "arGuardrailFractionPercent",
    label: "Overdue guardrail",
    type: "number",
    min: 0,
    step: 1,
    unit: "%",
    defaultValue: 25,
  },
  {
    key: "rateUSD",
    label: "USD → SGD",
    type: "number",
    min: 0,
    step: 0.0001,
    defaultValue: 1.35,
    help: "Set once a year so exchange-rate drift stays out of performance. Applies to the invoice register.",
  },
  { key: "rateHKD", label: "HKD → SGD", type: "number", min: 0, step: 0.0001, defaultValue: 0.17 },
  { key: "rateAUD", label: "AUD → SGD", type: "number", min: 0, step: 0.0001, defaultValue: 0.88 },
  { key: "rateGBP", label: "GBP → SGD", type: "number", min: 0, step: 0.0001, defaultValue: 1.71 },
  { key: "rateEUR", label: "EUR → SGD", type: "number", min: 0, step: 0.0001, defaultValue: 1.46 },
];

export const PAGE_SCHEMAS: Record<string, PageSchema> = {
  "dashboard/ceo/money": {
    label: "CEO · Money",
    fields: CEO_MONEY_FIELDS,
  },
  "dashboard/bizzcon/leaderboard": {
    label: "Bizzcon · Leaderboard",
    fields: LEADERBOARD_FIELDS,
  },
  "dashboard/awards/leaderboard": {
    label: "Awards · Leaderboard",
    fields: LEADERBOARD_FIELDS,
  },
  "dashboard/editorial/leaderboard": {
    label: "Editorial · Leaderboard",
    advancedExample: {
      excludePathIncludes: ["/commentary/"],
      dedupCrosspostsByPath: true,
    },
    fields: [
      ...LEADERBOARD_FIELDS,
      {
        key: "defaultRange",
        label: "Default time range",
        type: "select",
        options: [
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
          { value: "week", label: "This week" },
          { value: "month", label: "This month" },
        ],
        defaultValue: "30d",
      },
      {
        key: "defaultSection",
        label: "Default section",
        type: "string",
        help: "Section slug to filter by (leave empty for all).",
      },
    ],
  },
  "dashboard/awards/videos": {
    label: "Awards · Videos",
    fields: VIDEO_FIELDS,
  },
  "dashboard/bizzcon/videos": {
    label: "Bizzcon · Videos",
    fields: VIDEO_FIELDS,
  },
  "dashboard/editorial/videos": {
    label: "Editorial · Videos",
    fields: VIDEO_FIELDS,
  },
  "dashboard/awards/shorts": {
    label: "Awards · Shorts",
    fields: SHORTS_FIELDS,
  },
  "dashboard/bizzcon/shorts": {
    label: "Bizzcon · Shorts",
    fields: SHORTS_FIELDS,
  },
  "dashboard/editorial/shorts": {
    label: "Editorial · Shorts",
    fields: SHORTS_FIELDS,
  },
};

export const KNOWN_PAGE_KEYS = Object.keys(PAGE_SCHEMAS);
