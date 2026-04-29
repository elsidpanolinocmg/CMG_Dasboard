import type { Slug, Timestamped } from "./common";

export type PersonDepartmentRole =
  | "managing_editor"
  | "editor"
  | "reporter"
  | "admin"
  | "viewer";

export interface PersonDepartment extends Timestamped {
  personUsername: string;
  departmentSlug: Slug;
  role: PersonDepartmentRole;
  since: Date;
}
