import type { Timestamped } from "./common";

/**
 * A free-text label and URL the admin panel publishes to the public home page.
 * Separate from AdminReference, which is the same idea for the admin dashboard
 * — keeping them apart means an internal bookmark can never leak onto a screen
 * anyone in the office can see.
 *
 * `startsAt`/`endsAt` are ISO-8601 UTC strings rather than Dates: the row
 * arrives through the generic admin JSON route, where a Date has already been
 * serialised to a string, so storing the string is what actually happens either
 * way. Both are optional — an open end means "until someone hides it" — and
 * null is what a cleared date is stored as, since upsert only $sets the fields
 * it is handed.
 */
export interface QuickLink extends Timestamped {
  id: string;
  label: string;
  href: string;
  description?: string;
  order: number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** True when the link should be on the home page at `now`. */
export function isQuickLinkVisible(link: QuickLink, now: Date = new Date()): boolean {
  if (link.active === false) return false;
  const t = now.getTime();
  if (link.startsAt) {
    const start = Date.parse(link.startsAt);
    // An unparseable date must not silently publish the link early.
    if (Number.isNaN(start) || t < start) return false;
  }
  if (link.endsAt) {
    const end = Date.parse(link.endsAt);
    if (Number.isNaN(end) || t >= end) return false;
  }
  return true;
}
