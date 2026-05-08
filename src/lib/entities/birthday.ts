import type { Timestamped } from "./common";

export type BirthdayMediaKind = "image" | "video";

export interface Birthday extends Timestamped {
  id: string;
  displayName: string;
  birthMonth: number;
  birthDay: number;
  mediaKind: BirthdayMediaKind;
  mediaPath: string;
  active: boolean;
}
