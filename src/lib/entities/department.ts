import type { Slug, Timestamped } from "./common";

export interface Department extends Timestamped {
  slug: Slug;
  displayName: string;
  routePrefix: string;
  enabled: boolean;
  order: number;
}
