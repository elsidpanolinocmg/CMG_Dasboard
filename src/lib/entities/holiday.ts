import type { Timestamped } from "./common";

export interface Holiday extends Timestamped {
  date: string; // "YYYY-MM-DD" — anchored to a specific calendar date
  label: string;
}
