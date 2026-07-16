/**
 * Bullet-chart geometry. Kept out of the component so it can be asserted on.
 *
 * A bullet chart is a value, a reference marker, and qualitative bands behind
 * both. The bands are the RAG rule made visible: instead of the colour being an
 * invisible verdict, you can see which range the number actually landed in.
 */

/**
 * The tone that contrasts most with the chart surface always reads as the worst
 * band — darker on a light surface, lighter on a dark one. That invariant holds
 * whichever direction the value scale runs, which is what lets cash (more is
 * better) and receivables (less is better) share one visual language.
 */
export type BandTone = "good" | "fair" | "poor";

export interface Band {
  /** Upper edge of the band, in the same units as `value`. */
  upTo: number;
  tone: BandTone;
}

export interface Bullet {
  value: number;
  /** Where the marker sits: the paced target, or the trailing average. */
  reference: number;
  referenceLabel: string;
  /** Ascending; the last band's `upTo` is the end of the scale. */
  bands: Band[];
  scaleMax: number;
}

/**
 * Headroom past the *value*. Without it, any value that overshoots its band
 * defines the scale itself, the measure bar runs to the right edge, and the
 * band it landed in is hidden underneath — the chart stops showing the one
 * thing it exists to show.
 */
export const VALUE_HEADROOM = 1.1;

interface AscendingOptions {
  value: number;
  reference: number;
  referenceLabel: string;
  /** Fraction of the reference below which the value is poor. */
  amberAt: number;
  /** Fraction of the reference at or above which the value is good. */
  greenAt: number;
  /** Headroom past the reference, so a value on target is not pinned to the edge. */
  headroom: number;
}

/**
 * More is better — leads, cash, revenue. The poor band sits at the left, and
 * the marker is whatever the value is judged against.
 *
 * Returns null when the reference is not a positive number: there is no scale
 * to draw, and a bullet with nothing to compare against says nothing.
 */
export function ascendingBullet(options: AscendingOptions): Bullet | null {
  const { value, reference, referenceLabel, amberAt, greenAt, headroom } = options;
  if (!(reference > 0)) return null;

  const scaleMax = Math.max(reference * headroom, value * VALUE_HEADROOM);

  return {
    value,
    reference,
    referenceLabel,
    scaleMax,
    bands: [
      { upTo: reference * amberAt, tone: "poor" },
      { upTo: reference * greenAt, tone: "fair" },
      { upTo: scaleMax, tone: "good" },
    ],
  };
}

interface DescendingOptions {
  value: number;
  reference: number;
  referenceLabel: string;
  /** Multiple of the reference up to which the value is still good. */
  warnAt: number;
  /** Multiple of the reference beyond which the value is critical. */
  critAt: number;
  headroom: number;
}

/**
 * Less is better — overdue receivables, cost per lead. The bands mirror the
 * ascending case: good at the left, poor at the right.
 */
export function descendingBullet(options: DescendingOptions): Bullet | null {
  const { value, reference, referenceLabel, warnAt, critAt, headroom } = options;
  if (!(reference > 0)) return null;

  const scaleMax = Math.max(reference * headroom, value * VALUE_HEADROOM);

  return {
    value,
    reference,
    referenceLabel,
    scaleMax,
    bands: [
      { upTo: reference * warnAt, tone: "good" },
      { upTo: reference * critAt, tone: "fair" },
      { upTo: scaleMax, tone: "poor" },
    ],
  };
}

/** Band widths as percentages of the scale, left to right. */
export function bandWidths(bullet: Bullet): Array<{ tone: BandTone; width: number }> {
  let previous = 0;
  return bullet.bands.map((band) => {
    const upTo = Math.min(band.upTo, bullet.scaleMax);
    const width = ((upTo - previous) / bullet.scaleMax) * 100;
    previous = upTo;
    return { tone: band.tone, width: Math.max(width, 0) };
  });
}

export function percentOfScale(value: number, bullet: Bullet): number {
  return Math.min(Math.max((value / bullet.scaleMax) * 100, 0), 100);
}
