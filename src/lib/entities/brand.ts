import type { Slug, Timestamped } from "./common";

export interface Brand extends Timestamped {
  slug: Slug;
  displayName: string;
  image?: string;
  ga4FilterId?: string;
  ga4PropertyId?: string;
  drupalDomain?: string;
  groupSlug?: Slug;
  active: boolean;
}
