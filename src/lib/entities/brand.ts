import type { Slug, Timestamped } from "./common";

export interface Ga4Filter {
  fieldName: string;
  matchType: string;
  value: string;
}

export interface Brand extends Timestamped {
  slug: Slug;
  displayName: string;
  url?: string;
  color?: string;
  image?: string;
  ga4PropertyId?: string;
  ga4Filter?: Ga4Filter;
  drupalDomain?: string;
  awardsShowcaseId?: string;
  group?: string;
  departments: Slug[];
  active: boolean;
}
