import type { Slug, Timestamped } from "./common";

export interface DepartmentBrand extends Timestamped {
  departmentSlug: Slug;
  brandSlug: Slug;
  enabled: boolean;
  config?: Record<string, unknown>;
}
