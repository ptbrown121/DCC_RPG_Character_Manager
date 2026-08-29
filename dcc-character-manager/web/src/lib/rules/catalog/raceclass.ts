// Race & Class framework: shared types and the Point Build System.
// Source: Core Rulebook pp. 126–162 (extraction/core_pages_124-163.md).
// Race/class picks unlock on the Third Floor: 3 race options + 3 class options
// rolled/offered, or build your own with the point system below.

import type { StatKey } from "../stats";

export interface SkillGrant {
  name: string;
  ranks: number;
  /** This grant also lifts the skill's cap to Rank 20. */
  toRank20?: boolean;
  note?: string;
}

export interface CatalogRace {
  name: string;
  kind: "earth" | "alien";
  statBonuses: Partial<Record<StatKey, number>>;
  skillGrants: SkillGrant[];
  /** Terse mechanical rule hooks. */
  abilities: string[];
  drawbacks: string[];
  prerequisites?: string;
  /** Data-entry flags (misprints etc.). */
  note?: string;
}

export interface CatalogClass {
  name: string;
  /** Class categories this belongs to (Arcanist, Bard, Fighter, …). */
  classTypes: string[];
  statBonuses: Partial<Record<StatKey, number>>;
  skillGrants: SkillGrant[];
  abilities: string[];
  drawbacks: string[];
  prerequisites?: string;
  note?: string;
}

// ---------------------------------------------------------------- Point Build System

export const RACE_BUILD_POINTS = 25;
export const CLASS_BUILD_POINTS = 30;
/** Max extra BP from detriments per build (race and class each). */
export const MAX_DETRIMENT_BP = 5;

export type BenefitTier = "minor" | "moderate" | "major" | "extreme" | "epic";
export const BENEFIT_COST: Record<BenefitTier, number> = {
  minor: 1,
  moderate: 2,
  major: 3,
  extreme: 4,
  epic: 6,
};

export interface BuildBenefit {
  label: string;
  tier: BenefitTier;
  /** Taking it twice stacks (stat/skill bonuses) vs. does nothing (resistances). */
  stacks?: boolean;
}

/**
 * Benefit menu (pp. 159–160), compressed to mechanics. The book treats these as
 * examples and pricing guidance — original benefits are encouraged (GM prices them),
 * so the builder also supports custom entries at any tier.
 */
export const BUILD_BENEFITS: BuildBenefit[] = [
  // Minor — 1 BP
  { label: "+1 to a Stat", tier: "minor", stacks: true },
  { label: "Club membership (Desperado or Vanquisher)", tier: "minor" },
  { label: "+1 to end-of-floor Advancement Checks for one Skill", tier: "minor" },
  { label: "One specific Skill can be raised to Rank 20", tier: "minor" },
  { label: "Add Stat Mod twice for one non-combat Skill in a common circumstance", tier: "minor" },
  { label: "Conditional benefit (e.g. Advantage vs. stone creatures)", tier: "minor" },
  { label: "Darkvision or natural light source", tier: "minor" },
  { label: "Double Mana regen from mending/resting in a specific environment", tier: "minor" },
  { label: "See twice as far as most creatures", tier: "minor" },
  { label: "Tier-1 crafting table (appears in personal space)", tier: "minor" },
  { label: "Free room in saferooms", tier: "minor" },
  { label: "Store discount / sales bonus / interest bonus (+1 per category)", tier: "minor", stacks: true },
  { label: "Non-combat benefit 1/session under very specific conditions", tier: "minor" },
  // Moderate — 2 BP
  { label: "+1 in a Skill or Spell, incl. Passives (max 5 pts of Passives per class build)", tier: "moderate", stacks: true },
  { label: "Heal 1 HB slot on damage/kill with a specific Weapon Skill or Spell (max 5/combat)", tier: "moderate" },
  { label: "Add Stat Mod twice on attacks in a common circumstance", tier: "moderate" },
  { label: "Advantage on Advancement Checks for one Skill", tier: "moderate" },
  { label: "+1 end-of-floor Advancement Checks for a linked Skill group", tier: "moderate" },
  { label: "Change your damage type for a combat (chosen at start)", tier: "moderate" },
  { label: "+1 DR Buff (limit +3 total)", tier: "moderate", stacks: true },
  { label: "Access any guild of one type", tier: "moderate" },
  { label: "Double Mana regen from mending/resting (no limit)", tier: "moderate" },
  { label: "Membership in all professional and social clubs", tier: "moderate" },
  { label: "Dungeon Book of the Floor Club membership", tier: "moderate" },
  { label: "A linked Skill group can be raised to Rank 20", tier: "moderate" },
  { label: "Mobs drop Floor×1 gold when killed with a specific attack", tier: "moderate" },
  { label: "Gain Popularity from specific actions/attacks", tier: "moderate" },
  { label: "Patron Benefit", tier: "moderate" },
  { label: "Resistance to an uncommon damage type", tier: "moderate" },
  { label: "Resistance to environmental damage (falls, drowning, traps…)", tier: "moderate" },
  { label: "Swap the Stat used by an ability for another", tier: "moderate" },
  { label: "Add a second Stat Mod to specific Skills", tier: "moderate" },
  { label: "Use one weapon type's Skills with another weapon type", tier: "moderate" },
  { label: "Your healing Spells restore +1 HB slot", tier: "moderate" },
  { label: "Traverse certain terrain without Checks", tier: "moderate" },
  { label: "Burrow movement", tier: "moderate" },
  { label: "Breathe underwater", tier: "moderate" },
  { label: "+1 all Skills for ≤1 hour (temporary)", tier: "moderate" },
  { label: "Natural attack: 1d6+Stat Mod, Rank = Floor (+1d6 at Ranks 5/10/15)", tier: "moderate" },
  { label: "Reassign race/class Stat points once per floor (long rest)", tier: "moderate" },
  // Major — 3 BP
  { label: "Significant assistance (Manager-like benefit)", tier: "major" },
  { label: "Friendly Pet or Mount", tier: "major" },
  { label: "Buff all your Pets/Mounts (up to 4 points' worth)", tier: "major" },
  { label: "Dramatically alter an encounter 1/day", tier: "major" },
  { label: "Defensive ability 1/day (e.g. negate one attack's damage)", tier: "major" },
  { label: "Party-wide Buff 1/day (regen, extra DR…)", tier: "major" },
  { label: "Flight with limitations", tier: "major" },
  { label: "Survive without breathing (+immunity to inhaled toxins)", tier: "major" },
  { label: "Rage: melee +1 damage per HB slot lost", tier: "major" },
  { label: "Size 2 (Small) or less", tier: "major" },
  { label: "+5 ft Move", tier: "major", stacks: true },
  { label: "+5 ft Step", tier: "major", stacks: true },
  { label: "+1d4 to Evade or to Stat Checks for one Stat", tier: "major" },
  { label: "Natural attack: 1d8+Stat Mod, Rank = Floor (+1d8 at Ranks 5/10/15)", tier: "major" },
  { label: "Advantage with a specific non-combat Skill or Spell", tier: "major" },
  { label: "Situational ×2 damage for one round", tier: "major" },
  { label: "Use another Stat instead of CON for Health Bar values", tier: "major" },
  { label: "Climb movement (most surfaces, even ceilings)", tier: "major" },
  // Extreme — 4 BP
  { label: "+1 in a Skill you normally can't learn", tier: "extreme", stacks: true },
  { label: "+1 to all Skills in a linked group of 3–5", tier: "extreme", stacks: true },
  { label: "Advantage on all Stat Checks for one Stat", tier: "extreme" },
  { label: "A linked group of ≤6 Skills can be raised to Rank 20", tier: "extreme" },
  { label: "Immunity to Poison", tier: "extreme" },
  { label: "Resistance to a common damage type", tier: "extreme" },
  { label: "Double duration of your Rank ≤5 duration Spells", tier: "extreme" },
  { label: "Advantage on all Skills in a limited non-combat situation", tier: "extreme" },
  { label: "Additional functional arm", tier: "extreme" },
  { label: "Doppelgänger shape-changing", tier: "extreme" },
  // Epic — 6 BP
  { label: "+1 to all Skills in a linked group", tier: "epic", stacks: true },
  { label: "All Skills can be raised to Rank 20", tier: "epic" },
  { label: "Major defensive ability (common-type Immunity / halve first 9 attacks daily)", tier: "epic" },
  { label: "Limb Regeneration", tier: "epic" },
  { label: "Advantage on all Skills in wide-ranging circumstances", tier: "epic" },
  { label: "Immunity to Poison and all diseases", tier: "epic" },
  { label: "+1 all Skills in a linked group of 6+", tier: "epic", stacks: true },
  { label: "Powerful stat/skill-changing ability (Changeling-like)", tier: "epic" },
  { label: "Changeling shapeshifting", tier: "epic" },
  { label: "Advantage on all Skill Checks for one Stat", tier: "epic" },
  { label: "Unlimited flight", tier: "epic" },
];

export interface BuildDetriment {
  label: string;
  /** Extra BP refunded. */
  bp: number;
}

/** Detriment menu (p. 161), compressed. Refund cap: +5 BP per build. */
export const BUILD_DETRIMENTS: BuildDetriment[] = [
  { label: "Barred from a Class due to club membership", bp: 1 },
  { label: "−2 worth of Stat penalties", bp: 1 },
  { label: "−2 worth of Skill penalties (≤ current Rank; owned skills only)", bp: 1 },
  { label: "−1 to all Skills under one Stat", bp: 1 },
  { label: "+1 Mana cost for spells not favored by your Class", bp: 1 },
  { label: "Disadvantage with a linked Skill group under a condition", bp: 1 },
  { label: "Must worship a deity", bp: 1 },
  { label: "Cannot worship a deity", bp: 1 },
  { label: "−1 on Advancement Checks for a granted Skill at Rank 5+", bp: 1 },
  { label: "Vulnerability to an uncommon damage type", bp: 1 },
  { label: "Halve a broad off-focus damage type you deal", bp: 1 },
  { label: "Weakness with two conditions", bp: 1 },
  { label: "Delay a bonus until Level 50+ / Floor 6", bp: 1 },
  { label: "Weakness with one broad condition (e.g. Disadvantage in all social situations)", bp: 2 },
  { label: "A Skill only ranks up on floor descent", bp: 2 },
  { label: "Limited weapon choice", bp: 2 },
  { label: "No Stat Mod on your granted Weapon Skill", bp: 2 },
  { label: "+3 Mana cost for a class of granted spells", bp: 2 },
  { label: "Disadvantage with a linked Skill group (unconditional)", bp: 2 },
  { label: "Prohibited from a wide category of useful items", bp: 2 },
  { label: "One Stat capped at 10 (even gear/potions can't exceed)", bp: 3 },
  { label: "Vulnerability to a common damage type", bp: 3 },
];

/** Stat/skill penalty pricing: 1 BP per 2 points of penalties (round down). */
export function detrimentBpForPenaltyPoints(points: number): number {
  return Math.floor(Math.max(0, points) / 2);
}
