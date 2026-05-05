// Page-settings "advanced" JSON parsed into a typed shape.
//
// Shape:
//   {
//     brandFilters: { [brandSlug]: { pathStartsWith?: string[]; pathIncludes?: string[] } },
//     excludePathIncludes: string[],   // global deny-list applied across all brands
//     dedupCrosspostsByPath: boolean,  // default true; collapses crossposts to the highest-views row
//   }
//
// Unknown keys are ignored so the schema can grow over time without breaking
// saved settings.

export type BrandFilterRule = {
  pathStartsWith?: string[];
  pathIncludes?: string[];
};

export type AdvancedSettings = {
  brandFilters?: Record<string, BrandFilterRule>;
  excludePathIncludes?: string[];
  dedupCrosspostsByPath?: boolean;
};

// Back-compat alias for callers that imported the old name.
export type AdvancedBrandFilters = AdvancedSettings;

export function parseAdvancedSettings(raw: unknown): AdvancedSettings {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: AdvancedSettings = {};

  const bf = obj.brandFilters;
  if (bf && typeof bf === "object") {
    const filters: Record<string, BrandFilterRule> = {};
    for (const [brand, rule] of Object.entries(bf as Record<string, unknown>)) {
      if (!rule || typeof rule !== "object") continue;
      const r = rule as Record<string, unknown>;
      const cleaned: BrandFilterRule = {};
      if (Array.isArray(r.pathStartsWith)) {
        cleaned.pathStartsWith = r.pathStartsWith.filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        );
      }
      if (Array.isArray(r.pathIncludes)) {
        cleaned.pathIncludes = r.pathIncludes.filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        );
      }
      if (cleaned.pathStartsWith?.length || cleaned.pathIncludes?.length) {
        filters[brand] = cleaned;
      }
    }
    out.brandFilters = filters;
  }

  if (Array.isArray(obj.excludePathIncludes)) {
    const cleaned = obj.excludePathIncludes.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    if (cleaned.length > 0) out.excludePathIncludes = cleaned;
  }

  if (typeof obj.dedupCrosspostsByPath === "boolean") {
    out.dedupCrosspostsByPath = obj.dedupCrosspostsByPath;
  }

  return out;
}

export function isPathExcluded(path: string, advanced: AdvancedSettings): boolean {
  const list = advanced.excludePathIncludes;
  if (!list?.length) return false;
  return list.some((needle) => path.includes(needle));
}

// Back-compat: same signature, returns AdvancedSettings.
export const parseAdvancedBrandFilters = parseAdvancedSettings;

export function passesBrandFilter(
  brand: string,
  path: string,
  advanced: AdvancedSettings,
): boolean {
  const rule = advanced.brandFilters?.[brand];
  if (!rule) return true;
  if (rule.pathStartsWith?.length) {
    if (!rule.pathStartsWith.some((p) => path.startsWith(p))) return false;
  }
  if (rule.pathIncludes?.length) {
    if (!rule.pathIncludes.some((p) => path.includes(p))) return false;
  }
  return true;
}
