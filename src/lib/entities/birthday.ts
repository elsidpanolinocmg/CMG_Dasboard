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
  // Video only: when true, the slide stays until the video plays through once
  // (instead of being cut off at the normal slide interval) and does not loop.
  // Ignored for images. Missing/false keeps the looping, fixed-duration behavior.
  finishVideo?: boolean;
}
