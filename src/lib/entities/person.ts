import type { Slug, Timestamped } from "./common";

export type PersonDepartmentRole =
  | "managing_editor"
  | "editor"
  | "reporter"
  | "admin"
  | "viewer";

export interface PersonAuth {
  passwordHash: string;
  lastLoginAt?: Date;
}

export interface PersonDepartmentMembership {
  departmentSlug: Slug;
  role: PersonDepartmentRole;
  since: Date;
  // Free-form per-department metadata. Editorial may store byline/bio,
  // awards may store team or quota notes, etc. Keep this flexible —
  // each department defines its own keys.
  properties?: Record<string, string>;
}

export interface Person extends Timestamped {
  username: string;
  displayName: string;
  email?: string;
  active: boolean;
  nameKeys: string[];
  departments: PersonDepartmentMembership[];
  auth?: PersonAuth;
}
