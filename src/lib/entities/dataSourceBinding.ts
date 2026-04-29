import type { Slug, Timestamped } from "./common";
import type { ExternalDataSourceKind } from "./externalDataSource";

export type BindingPurpose =
  | "leaderboard"
  | "sponsorship"
  | "analytics"
  | "content"
  | "media";

export interface DataSourceBinding extends Timestamped {
  departmentSlug: Slug;
  dataSourceKind: ExternalDataSourceKind;
  purpose: BindingPurpose;
  config: Record<string, unknown>;
}
