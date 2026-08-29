// Popularity, worship, and sponsor constants.
// Sources: CORE_REFERENCE.md §2 (pp. 279–284 Popularity/Top Ten/Sponsors; pp. 162–171 Deities & Worship).

/** Worship tiers with their tithe percentages. */
export const WORSHIP_TIERS = [
  { value: "acolyte", label: "Acolyte", tithePct: 5 },
  { value: "devotee", label: "Devotee", tithePct: 10 },
  { value: "zealot", label: "Zealot", tithePct: 20 },
] as const;
export type WorshipTier = (typeof WORSHIP_TIERS)[number]["value"];

/** A boon is earned every 5 consecutive days of offerings. */
export const BOON_STREAK_DAYS = 5;

/** Fan Boxes arrive at these Popularity milestones. */
export const FAN_BOX_MILESTONES = [25, 50, 100] as const;

/** Up to 3 sponsors, at most one gained per floor. */
export const MAX_SPONSORS = 3;

/** Popularity is tracked numerically from Floor 3 (narrative-only before that). */
export const POPULARITY_START_FLOOR = 3;

/** Top Ten list exists from Floor 4 (daily infraction/accomplishment adjustments, bounties). */
export const TOP_TEN_START_FLOOR = 4;

export function nextFanBox(popularity: number): number | null {
  return FAN_BOX_MILESTONES.find((m) => popularity < m) ?? null;
}

// ---------------------------------------------------------------- grinding

/** Safe grinding hours per 30-hour day; beyond this, Unopposed Endurance Check or the hour is wasted + Fatigued. */
export const SAFE_GRIND_HOURS_PER_DAY = 5;

/** Bonus grind hours: Neighborhood Map +1 (on a 5+ hour grind), Borough Field Guide +2. */
export const GRIND_BONUSES = { neighborhoodMap: 1, boroughFieldGuide: 2 } as const;

/** A skill's advancement check triggers when accrued grind hours reach its current rank. */
export function grindCheckReady(grindHours: number, rank: number): boolean {
  return rank >= 1 && grindHours >= rank;
}

/** Level-up from grinding: running total of all grind hours reaches current level. */
export function grindLevelReady(totalHours: number, level: number): boolean {
  return totalHours >= level;
}
