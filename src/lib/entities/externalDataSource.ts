import type { Timestamped } from "./common";

export type ExternalDataSourceKind =
  | "mongodb"
  | "google_sheets"
  | "ga4"
  | "vimeo"
  | "drupal_jsonapi";

export interface ExternalDataSource extends Timestamped {
  kind: ExternalDataSourceKind;
  displayName: string;
  credentialRef: string;
}
