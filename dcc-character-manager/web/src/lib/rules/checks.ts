// The check engine: difficulty formulas and degrees of success.
// Source: RULES_REFERENCE.md §4.

/** Opposed check: an antagonist is in the way. */
export function opposedDifficulty(antagonistStatMod: number, floor: number): number {
  return 10 + antagonistStatMod + floor;
}

/** Unopposed check: environment/survival. */
export function unopposedDifficulty(floor: number): number {
  return 10 + floor * 2;
}

/** Stat Check: stat mod only, no ranks, no aid, no Intervene. */
export function statCheckDifficulty(floor: number): number {
  return 10 + floor;
}

export type Degree =
  | "critical-hit"
  | "amazing-success"
  | "success"
  | "near-miss"
  | "fail"
  | "major-fail"
  | "critical-fail";

/**
 * Degree of success/failure. Only the single highest degree applies;
 * a tie with the Difficulty is a Success (by 0).
 */
export function degreeOfSuccess(naturalRoll: number, total: number, difficulty: number): Degree {
  if (naturalRoll === 20) return "critical-hit";
  if (naturalRoll === 1) return "critical-fail";
  const margin = total - difficulty;
  if (margin >= 10) return "amazing-success";
  if (margin >= 0) return "success";
  if (margin >= -2) return "near-miss";
  if (margin >= -9) return "fail";
  return "major-fail";
}

export const DEGREE_LABELS: Record<Degree, string> = {
  "critical-hit": "Critical Hit (nat 20)",
  "amazing-success": "Amazing Success (by 10+)",
  success: "Success",
  "near-miss": "Near Miss (fail by 1–2)",
  fail: "Fail (by 3–9)",
  "major-fail": "Major Fail (by 10+)",
  "critical-fail": "Critical Fail (nat 1)",
};

/**
 * Mobs never roll d20s. Mob Advantage = +5 to the Mob's Difficulty;
 * Mob Disadvantage = −5, and targets get a free Evade Check.
 */
export const MOB_ADVANTAGE_MOD = 5;

/** Amazing-Success / Major-Fail bonus damage equals the Floor Number. */
export function degreeBonusDamage(floor: number): number {
  return floor;
}
