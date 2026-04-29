import type { Timestamped } from "./common";

export interface SavedReference extends Timestamped {
  id: string;
  label: string;
  spreadsheetId: string;
  sheetName?: string;
  description?: string;
}
