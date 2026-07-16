import { fromEpochDay, isBusinessDay, toEpochDay, TREND_WEEKS, weekStart } from "@/lib/ceo/week";
import { MARKETING_CONFIG } from "./config";
import type { DayPoint, LeadLedger } from "./types";

/**
 * Deterministic stand-in data, used until the ad platforms are connected.
 *
 * Every lead and every dollar below is invented, as are the targets in
 * `config.ts`. The generator gives each week its own volume and its own
 * efficiency so the two sparklines move independently — a good week for lead
 * count is not automatically a good week for cost per lead, and the dashboard
 * should be able to show that.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weekends still run ads, but at a fraction of a weekday's volume. */
const WEEKEND_VOLUME = 0.12;

export function generateSampleLeadLedger(todayDate: string): LeadLedger {
  const rand = mulberry32(20260709);
  const config = MARKETING_CONFIG;
  const today = toEpochDay(todayDate);
  const firstFriday = weekStart(today) - (TREND_WEEKS - 1) * 7;

  const days: DayPoint[] = [];

  for (let w = 0; w < TREND_WEEKS; w++) {
    const openingFriday = firstFriday + w * 7;

    // Volume swings ±15% around the target; efficiency from 8% under the cost
    // goal to 20% over. The spread is wide enough that the 13 weeks visit every
    // RAG band — a sample dashboard that only ever shows one colour has not
    // demonstrated the thing it exists to demonstrate.
    const volume = 0.85 + rand() * 0.3;
    const efficiency = 0.92 + rand() * 0.28;

    for (let d = 0; d < 7; d++) {
      const day = openingFriday + d;
      if (day > today) break;

      const share = isBusinessDay(day) ? 1 : WEEKEND_VOLUME;
      const base = ((config.weeklyLeadTarget * volume) / 5) * share;
      const leads = Math.max(0, Math.round(base * (0.82 + rand() * 0.36)));

      const costPerLead = config.costPerLeadTarget * efficiency * (0.94 + rand() * 0.12);
      const spend = Math.round(leads * costPerLead * 100) / 100;

      days.push({ date: fromEpochDay(day), leads, spend });
    }
  }

  return { days, config };
}
