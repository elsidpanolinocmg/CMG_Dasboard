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
  // When true, the "Happy Birthday, {name}!" caption is hidden on the slide
  // (image/video only). Missing/false on existing records keeps the caption.
  hideGreeting?: boolean;
}
