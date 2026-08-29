// Derived crawler values.
// Sources: RULES_REFERENCE.md §2, §9, §11; CRAWLERS_REFERENCE.md steps 4–8;
// CORE_REFERENCE.md §3 delta 1 (Health = CON Mod × 10, verified core p. 111).

import { statMod, type StatScores } from "./stats";

export const CRAWLER_HB_SLOTS = 10;
export const DEFAULT_MOVE_FT = 20;
export const STEP_FT = 10;
export const ACTIONS_PER_ROUND = 2;
export const ROUND_SECONDS = 10;
export const DUNGEON_DAY_HOURS = 30;

export interface DerivedValues {
  mods: Record<keyof StatScores, number>;
  /** Each of the 10 HB slots holds the CON Mod. */
  hbSlotValue: number;
  /** Total Health = CON Mod × 10. */
  maxHealth: number;
  hbSlots: number;
  /** Mana Points = Intelligence score (1:1), from the Enhanced layer. */
  maxMana: number;
  /** Evade is not a Skill: d20 + DEX Mod only. */
  evadeBonus: number;
  /** Lift/store limit = Strength score × 15 lbs. */
  liftLimitLbs: number;
  moveFt: number;
  /** Breath-holding rounds and the Dying countdown both equal the CON Mod. */
  breathRounds: number;
  dyingCountdown: number;
  /** Move Rate Modifier for races/chases = Move ÷ 10, round down. */
  moveRateMod: number;
}

export function deriveFromEnhanced(enhanced: StatScores, moveFt = DEFAULT_MOVE_FT): DerivedValues {
  const mods = {
    str: statMod(enhanced.str),
    int: statMod(enhanced.int),
    con: statMod(enhanced.con),
    dex: statMod(enhanced.dex),
    cha: statMod(enhanced.cha),
  };
  return {
    mods,
    hbSlotValue: mods.con,
    maxHealth: mods.con * 10,
    hbSlots: CRAWLER_HB_SLOTS,
    maxMana: enhanced.int,
    evadeBonus: mods.dex,
    liftLimitLbs: enhanced.str * 15,
    moveFt,
    breathRounds: mods.con,
    dyingCountdown: mods.con,
    moveRateMod: Math.floor(moveFt / 10),
  };
}

/**
 * Apply damage to a Health Bar (after DR/resistances). Remove slots until the
 * removed value ≥ damage; damage smaller than one slot's value is lost entirely.
 */
export function slotsLostToDamage(damage: number, slotValue: number): number {
  if (slotValue <= 0) return 0;
  if (damage < slotValue) return 0;
  return Math.ceil(damage / slotValue);
}

/** Mitigation order: DR → Elemental Resistance (half) → Vulnerability (double) → Immunity (zero). */
export function mitigateDamage(
  raw: number,
  opts: { dr?: number; resistant?: boolean; vulnerable?: boolean; immune?: boolean; bypassDr?: boolean } = {},
): number {
  if (opts.immune) return 0;
  let dmg = raw;
  if (!opts.bypassDr) dmg = Math.max(0, dmg - (opts.dr ?? 0));
  if (opts.resistant) dmg = Math.floor(dmg / 2);
  if (opts.vulnerable) dmg = dmg * 2;
  return dmg;
}

export const DAMAGE_TYPES = [
  "Acid",
  "Bludgeoning",
  "Electric",
  "Fire",
  "Force",
  "Holy",
  "Ice",
  "Necrotic",
  "Piercing",
  "Poison",
  "Psychic",
  "Slashing",
  "Sonic",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Resting recovery (RULES_REFERENCE §9). */
export const REST_RULES = {
  shortRestHours: 2,
  shortRestSlots: 5, // + half total Mana (round down)
  longRestHours: 8, // full HB & Mana, clears Fatigued
  fullDayHours: 30, // long rest + heals long-term injuries
  passiveSlotPerHour: 1,
  passiveManaPerHour: 5,
  healSpellSlots: 2, // everyone's Heal spell restores 2 slots (20%)
} as const;
