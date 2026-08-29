// Mob/boss builder math and encounter sizing.
// Source: GM_REFERENCE.md §2 (core rulebook pp. 266–277, Tables 49–51).

import { statMod, type StatScores } from "./stats";

export const BOSS_TIERS = [
  "neighborhood",
  "borough",
  "city",
  "province",
  "country",
  "floor",
] as const;
export type BossTier = (typeof BOSS_TIERS)[number];

export const BOSS_TIER_LABELS: Record<BossTier, string> = {
  neighborhood: "Neighborhood",
  borough: "Borough",
  city: "City",
  province: "Province",
  country: "Country",
  floor: "Floor",
};

/** Table 50: Boss Severity — stat points per level and HB slots (base + Floor). */
export const BOSS_SEVERITY: Record<BossTier, { statsPerLevel: number; hbBase: number }> = {
  neighborhood: { statsPerLevel: 3, hbBase: 10 },
  borough: { statsPerLevel: 4, hbBase: 15 },
  city: { statsPerLevel: 5, hbBase: 20 },
  province: { statsPerLevel: 6, hbBase: 25 },
  country: { statsPerLevel: 8, hbBase: 30 },
  floor: { statsPerLevel: 10, hbBase: 40 },
};

/** Levels gained by the whole party for killing a boss of each tier. */
export const BOSS_LEVEL_REWARD: Record<BossTier, number> = {
  neighborhood: 1,
  borough: 2,
  city: 3,
  province: 4,
  country: 5,
  floor: 6,
};

/** Regular mob HB slots = Level, max 10. Each slot's value = the mob's CON Mod. */
export function mobHbSlots(level: number): number {
  return Math.max(1, Math.min(10, level));
}

/** Boss HB slots = severity base + Floor Number (Table 50). */
export function bossHbSlots(tier: BossTier, floor: number): number {
  return BOSS_SEVERITY[tier].hbBase + floor;
}

/**
 * Stat-point budget to distribute across the five stat scores.
 * Mobs: 1 per stat + 3 per level. Bosses: 5 per stat + severity points per level.
 */
export function statBudget(level: number, bossTier?: BossTier): { base: number; pool: number; total: number } {
  const base = bossTier ? 5 : 1;
  const perLevel = bossTier ? BOSS_SEVERITY[bossTier].statsPerLevel : 3;
  const pool = perLevel * level;
  return { base, pool, total: base * 5 + pool };
}

export function budgetSpent(scores: StatScores): number {
  return scores.str + scores.int + scores.con + scores.dex + scores.cha;
}

/** Surprise Difficulty = 10 + INT Mod, +F at the table. */
export function mobSurprise(intScore: number): number {
  return 10 + statMod(intScore);
}

/** Evade Difficulty (crawler attacks vs. the mob) = 10 + DEX Mod, +F at the table. */
export function mobEvade(dexScore: number): number {
  return 10 + statMod(dexScore);
}

/** Mob DR = Floor Number (+1/+2 armored, −1/−2 casters; imported mobs keep home-floor DR). */
export function mobDr(floor: number, adjust = 0): number {
  return Math.max(0, floor + adjust);
}

/** Typical bipedal mob Move = 20 + Size. */
export function mobMove(size: number): number {
  return 20 + size;
}

/** Table 51: Mob Level → damage dice count (d6 standard) and typical floors. */
export const DAMAGE_DICE_TABLE: { minLevel: number; maxLevel: number; dice: number; floors: [number, number] }[] = [
  { minLevel: 1, maxLevel: 4, dice: 1, floors: [1, 1] },
  { minLevel: 5, maxLevel: 9, dice: 2, floors: [2, 2] },
  { minLevel: 10, maxLevel: 29, dice: 3, floors: [3, 4] },
  { minLevel: 30, maxLevel: 59, dice: 5, floors: [5, 7] },
  { minLevel: 60, maxLevel: 99, dice: 7, floors: [8, 10] },
  { minLevel: 100, maxLevel: 159, dice: 9, floors: [11, 13] },
  { minLevel: 160, maxLevel: 249, dice: 12, floors: [14, 16] },
  { minLevel: 250, maxLevel: Infinity, dice: 15, floors: [17, 18] },
];

/** Damage dice count for a mob level. Debuff-rider attacks use d4s; AoE/triggered attacks drop one die. */
export function damageDiceForLevel(level: number): number {
  const row = DAMAGE_DICE_TABLE.find((r) => level >= r.minLevel && level <= r.maxLevel);
  return row ? row.dice : 1;
}

/** Typical mob level range for a floor (Table 51 read in reverse). */
export function typicalMobLevels(floor: number): [number, number] | null {
  const row = DAMAGE_DICE_TABLE.find((r) => floor >= r.floors[0] && floor <= r.floors[1]);
  return row ? [row.minLevel, row.maxLevel === Infinity ? 250 : row.maxLevel] : null;
}

/** Bosses use the NEXT row down on Table 51 relative to the floor's mobs. */
export function typicalBossLevels(floor: number): [number, number] | null {
  const idx = DAMAGE_DICE_TABLE.findIndex((r) => floor >= r.floors[0] && floor <= r.floors[1]);
  if (idx < 0 || idx + 1 >= DAMAGE_DICE_TABLE.length) return null;
  const row = DAMAGE_DICE_TABLE[idx + 1];
  return [row.minLevel, row.maxLevel === Infinity ? 250 : row.maxLevel];
}

export const ENCOUNTER_STRENGTHS = ["weak", "moderate", "strong", "overwhelming"] as const;
export type EncounterStrength = (typeof ENCOUNTER_STRENGTHS)[number];

export const STRENGTH_LABELS: Record<EncounterStrength, string> = {
  weak: "Weak (50%)",
  moderate: "Moderate (100%)",
  strong: "Strong (150%)",
  overwhelming: "Overwhelming (200%)",
};

/** Table 49: Adversary Power — number of mobs by party size (2–7). "+" = or more (overwhelming). */
const ADVERSARY_POWER: Record<EncounterStrength, Record<number, number>> = {
  weak: { 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4 },
  moderate: { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 },
  strong: { 2: 3, 3: 5, 4: 6, 5: 8, 6: 9, 7: 11 },
  overwhelming: { 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14 },
};

export function suggestedMobCount(partySize: number, strength: EncounterStrength): number {
  const size = Math.max(2, Math.min(7, partySize));
  return ADVERSARY_POWER[strength][size];
}

/** Trap damage = (Floor Number)d6. No traps in rooms with stairwells to lower floors. */
export function trapDamageDice(floor: number): string {
  return `${floor}d6`;
}

/**
 * HB slot percentage labels: 100 ÷ slots per slot, cumulative, rounded so the
 * rightmost slot reads exactly 100%.
 */
export function hbSlotPercentages(slots: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= slots; i++) out.push(Math.round((100 * i) / slots));
  if (out.length) out[out.length - 1] = 100;
  return out;
}

/**
 * Action economy: regular mobs get 1 Move + 1 Action; Elites and Bosses get
 * 1 Action per crawler (even if crawlers are down).
 */
export function mobActions(isEliteOrBoss: boolean, crawlerCount: number): string {
  return isEliteOrBoss ? `${crawlerCount} Actions (1 per crawler)` : "1 Move + 1 Action";
}

export const CREATURE_SIZES = [
  { value: 1, label: "Tiny (rat)" },
  { value: 2, label: "Small (cat)" },
  { value: 3, label: "Petite (goblin)" },
  { value: 4, label: "Medium (human)" },
  { value: 5, label: "Large (horse)" },
  { value: 6, label: "Huge (elephant)" },
  { value: 7, label: "Colossal (dragon)" },
  { value: 8, label: "Gargantuan (kaiju)" },
] as const;

/** Floor collapse timers in 30-hour dungeon days. */
export const FLOOR_TIMERS: Record<number, number> = { 1: 5, 2: 6, 3: 8, 4: 10, 5: 15 };
