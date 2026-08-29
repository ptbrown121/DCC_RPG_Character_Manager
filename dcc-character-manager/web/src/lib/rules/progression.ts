// Leveling and advancement. No experience points in this system.
// Sources: CRAWLERS_REFERENCE.md §6; CORE_REFERENCE.md §3 deltas 3, 6.

export const LEVEL_CAP = 250;

/** Skill rank working cap on Floors 1–5 (race/class benefits can raise specific skills to 20). */
export const RANK_CAP_EARLY = 15;
export const RANK_CAP_ABSOLUTE = 20;

/** Rank 16+ skill benefits stay dormant until this floor. */
export const RANK_16_UNLOCK_FLOOR = 6;

/** Rank 10+ skill upgrades activate on this floor. */
export const RANK_10_UNLOCK_FLOOR = 3;

/**
 * Stat points on level-up: 3 per level, starting on the Third Floor.
 * Creation shortcut for higher-level entry: (Level − 1) × 3.
 */
export const STAT_POINTS_PER_LEVEL = 3;
export function creationStatPoints(level: number): number {
  return Math.max(0, (level - 1) * STAT_POINTS_PER_LEVEL);
}

/** Party-wide level sources (besides bosses — see BOSS_LEVEL_REWARD in adversary.ts). */
export const LEVEL_SOURCES = [
  "Every 2 hours of play: +1 level (whole party)",
  "Quest completed: +1 or more",
  "Killing a crawler: 1d6 ± level difference (max 15, min 1)",
  "Grinding: running hour total reaches current level → +1, reset",
] as const;

/**
 * Skill advancement: any attempt (success or fail) marks the skill (one mark max).
 * Advancement check: 1d20 ≥ current rank → +1 rank.
 * Rank ≤ 4: check every 2 hours of play. Rank ≥ 5: check at end of each floor.
 */
export function advancementCheckPasses(d20: number, currentRank: number): boolean {
  return d20 >= currentRank;
}

/** Rank Damage Dice (core Table 37, to Rank 20). Not base damage → never doubled on crits. */
export function rankDamageDie(rank: number): string {
  if (rank <= 0) return "—";
  if (rank === 1) return "+1";
  if (rank <= 3) return "+1d2";
  if (rank <= 5) return "+1d4";
  if (rank <= 7) return "+1d6";
  if (rank <= 9) return "+1d8";
  if (rank <= 11) return "+1d10";
  if (rank <= 13) return "+1d12";
  if (rank <= 15) return "+2d6";
  if (rank <= 17) return "+2d8";
  return "+2d10";
}

/** Character creation entry points (core rulebook higher-floor creation). */
export const ENTRY_POINTS = [
  { level: 1, floor: 1, label: "Level 1 — Tutorial Floors (starter rules)" },
  { level: 10, floor: 3, label: "Level 10 — Floor 3 entry" },
  { level: 20, floor: 4, label: "Level 20 — Floor 4 entry" },
  { level: 30, floor: 5, label: "Level 30 — Floor 5 entry" },
] as const;
