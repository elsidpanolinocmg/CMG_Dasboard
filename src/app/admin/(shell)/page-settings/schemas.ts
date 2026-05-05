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

export const PAGE_SCHEMAS: Record<string, PageSchema> = {
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
