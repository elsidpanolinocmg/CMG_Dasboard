import type { Slug, Timestamped } from "./common";

export type DashboardSlug =
  | "overview"
  | "videos"
  | "shorts"
  | "leaderboard"
  | "sponsorship";

export interface Dashboard extends Timestamped {
  departmentSlug: Slug;
  slug: DashboardSlug;
  routePath: string;
  enabled: boolean;
  order: number;
}
