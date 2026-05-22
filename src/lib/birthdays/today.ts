import * as birthdaysRepo from "@/lib/repos/birthdays";
import * as holidaysRepo from "@/lib/repos/holidays";
import { isPageEnabled } from "@/lib/birthdays/visibility";
import type { BirthdaySlideEntry } from "@/components/BirthdaySlide";

const MAX_LOOKBACK_DAYS = 7;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

async function isNonWorkingDay(d: Date, holidayDates: Set<string>): Promise<boolean> {
  if (isWeekend(d)) return true;
  return holidayDates.has(ymd(d));
}

export async function getTodaysBirthdaySlides(
  pageKey?: string,
  now: Date = new Date(),
): Promise<BirthdaySlideEntry[]> {
  // If the caller identified a page, honor the admin's per-page visibility.
  // Pages without a key (legacy callers) bypass the gate and behave as before.
  if (pageKey && !(await isPageEnabled(pageKey))) return [];

  // Pull all holidays once. The list is small (a few dozen rows per year).
  const holidays = await holidaysRepo.listAll();
  const holidayDates = new Set(holidays.map((h) => h.date));

  // If today is itself a non-working day, defer everything to the next
  // working day — show nothing now.
  if (await isNonWorkingDay(now, holidayDates)) return [];

  // Today is a working day. Collect dates whose birthdays should surface
  // today: today itself, plus any consecutive non-working days immediately
  // before it (so a Monday picks up Sat + Sun, and the day after a long
  // weekend picks up the whole stretch).
  const datesToShow: { month: number; day: number }[] = [
    { month: now.getMonth() + 1, day: now.getDate() },
  ];

  const cursor = new Date(now);
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (await isNonWorkingDay(cursor, holidayDates)) {
      datesToShow.push({ month: cursor.getMonth() + 1, day: cursor.getDate() });
    } else {
      break;
    }
  }

  // Fetch matching birthdays for each date and dedupe by id.
  const seen = new Set<string>();
  const out: BirthdaySlideEntry[] = [];
  for (const d of datesToShow) {
    // Build a Date with the right month/day so we can reuse listForToday.
    const probe = new Date(now);
    probe.setMonth(d.month - 1);
    probe.setDate(d.day);
    const rows = await birthdaysRepo.listForToday(probe);
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        id: r.id,
        displayName: r.displayName,
        mediaKind: r.mediaKind,
        mediaPath: r.mediaPath,
        hideGreeting: r.hideGreeting ?? false,
        finishVideo: r.finishVideo ?? false,
      });
    }
  }
  return out;
}
