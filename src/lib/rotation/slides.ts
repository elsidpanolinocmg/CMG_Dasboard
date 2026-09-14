import { getTodaysBirthdaySlides } from "@/lib/birthdays/today";
import * as customPagesRepo from "@/lib/repos/customPages";
import type { CustomPage } from "@/lib/entities";
import type { BirthdaySlideEntry } from "@/components/BirthdaySlide";

export function customPageToSlide(p: CustomPage): BirthdaySlideEntry {
  return {
    id: `custom-${p.id}`,
    kind: "custom",
    displayName: p.title,
    mediaKind: p.mediaKind,
    mediaPath: p.mediaPath,
    hideGreeting: true,
    finishVideo: p.mediaKind === "video" && !!p.finishVideo,
    inNext: !!p.includeInNext,
    showTitle: !!p.showTitle,
  };
}

/**
 * Everything a dashboard slots into its rotation: today's birthdays (gated by
 * the birthday visibility setting) followed by live custom pages assigned to
 * `pageKey`. Either source failing leaves the other intact.
 */
export async function getRotationSlides(pageKey: string): Promise<BirthdaySlideEntry[]> {
  const [birthdays, custom] = await Promise.all([
    getTodaysBirthdaySlides(pageKey).catch((err) => {
      console.error("rotation: birthdays failed", err);
      return [] as BirthdaySlideEntry[];
    }),
    customPagesRepo.listForRotation(pageKey).catch((err) => {
      console.error("rotation: custom pages failed", err);
      return [] as CustomPage[];
    }),
  ]);
  return [...birthdays, ...custom.map(customPageToSlide)];
}
