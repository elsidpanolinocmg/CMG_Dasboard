import type { Slug, Timestamped } from "./common";

export interface BrandGroup extends Timestamped {
  slug: Slug;
  displayName: string;
}
