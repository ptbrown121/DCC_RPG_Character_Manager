// Starter-set skill catalog (mechanical data): Crawlers & Customization pp. 21–35.
// Effects are compressed to their mechanics; full text lives in the extraction files.
// Core-book additions (Rapier, Lance, ~30 more utility skills…) can be appended later.

import type { StatKey } from "../stats";

export type CheckType = "opposed" | "unopposed" | "passive" | "evade";

export interface CatalogSkill {
  name: string;
  category: "attack" | "utility";
  /** Governing stat; null for pure passives. */
  stat: StatKey | null;
  checkType: CheckType;
  /** Attack skills: base damage, e.g. "1d6+STR Slashing". */
  damage?: string;
  range?: string;
  aiFavor?: number;
  animalOnly?: boolean;
  twoHanded?: boolean;
  /** Terse mechanics/limits summary. */
  effect?: string;
  /** Rank 5 upgrade, terse. Attack R5s also add +1 base damage die unless noted. */
  rank5?: string;
  /** Hand-to-hand pairing: allowed Damage Effects. */
  damageEffects?: string[];
}

export const ATTACK_SKILLS: CatalogSkill[] = [
  // Strikes & melee weapons
  { name: "Back Claw", category: "attack", stat: "str", checkType: "evade", damage: "1d6+STR Slashing", animalOnly: true },
  { name: "Bite", category: "attack", stat: "str", checkType: "evade", damage: "1d8+STR Piercing", animalOnly: true, effect: "Needs an appendage to clamp" },
  { name: "Slice Attack", category: "attack", stat: "dex", checkType: "evade", damage: "1d4+STR Slashing", animalOnly: true, aiFavor: 1 },
  { name: "Club", category: "attack", stat: "str", checkType: "evade", damage: "1d6+STR Bludgeoning" },
  { name: "Improvised Weapons", category: "attack", stat: "str", checkType: "evade", damage: "1d4+STR Bludgeoning", aiFavor: 1, effect: "Object 1 lb–STR lbs", rank5: "Can throw, range Rank×5 ft" },
  { name: "Warhammer", category: "attack", stat: "str", checkType: "evade", damage: "1d10+STR Bludgeoning", twoHanded: true },
  { name: "Axe", category: "attack", stat: "str", checkType: "evade", damage: "1d6+STR Slashing" },
  { name: "Dagger", category: "attack", stat: "dex", checkType: "evade", damage: "1d4+STR Piercing", aiFavor: 1, rank5: "Armor-Piercing (ignores DR)" },
  { name: "Longsword", category: "attack", stat: "str", checkType: "evade", damage: "1d8+STR Slashing" },
  { name: "Polearm", category: "attack", stat: "str", checkType: "evade", damage: "1d8+STR Piercing", range: "10 ft reach", twoHanded: true },
  { name: "Quarterstaff", category: "attack", stat: "str", checkType: "evade", damage: "1d6+STR Bludgeoning", range: "10 ft reach", twoHanded: true },
  // Hand-to-hand
  { name: "Unarmed Combat", category: "attack", stat: "str", checkType: "evade", damage: "1d4+STR Bludgeoning", aiFavor: 1, effect: "No Damage Effects allowed" },
  { name: "Pugilism", category: "attack", stat: "dex", checkType: "evade", damage: "1d2+STR Bludgeoning", aiFavor: 2, damageEffects: ["Iron Punch", "Powerful Strike"], rank5: "+2d2 instead of +1 die" },
  { name: "Foot Soldier", category: "attack", stat: "str", checkType: "evade", damage: "1d4+STR Bludgeoning", aiFavor: 1, damageEffects: ["Powerful Strike", "Smush"] },
  { name: "Noggin Nocker", category: "attack", stat: "str", checkType: "evade", damage: "1d4+CON Bludgeoning", aiFavor: 1, damageEffects: ["Skullcracker", "Powerful Strike"], effect: "You lose 1 HB slot on a Success", rank5: "No more self-damage" },
  { name: "Wrasslin'", category: "attack", stat: "str", checkType: "evade", damage: "1d4+STR Bludgeoning", aiFavor: 1, damageEffects: ["Choke Out", "Toss"], effect: "Success also inflicts Held; prevent escape = Interrupt + STR-Opposed check", rank5: "Maintain Held without an Action" },
  // Ranged (DEX to hit)
  { name: "Bow", category: "attack", stat: "dex", checkType: "evade", damage: "1d6+STR Piercing", range: "100 ft", twoHanded: true, effect: "Ammo" },
  { name: "Crossbow", category: "attack", stat: "dex", checkType: "evade", damage: "1d8 Piercing (no mod)", range: "50 ft", twoHanded: true, effect: "Ammo; 1/round" },
  { name: "Handgun", category: "attack", stat: "dex", checkType: "evade", damage: "1d8 Piercing (no mod)", range: "150 ft", effect: "Ammo; reload (1 Action) after Major Fail+" },
  { name: "Javelin", category: "attack", stat: "dex", checkType: "evade", damage: "1d8+STR Piercing", range: "40 ft" },
  { name: "Shotgun", category: "attack", stat: "dex", checkType: "evade", damage: "1d10 Piercing (no mod)", range: "30 ft", twoHanded: true, effect: "Ammo; reload after Major Fail+" },
  { name: "Shuriken", category: "attack", stat: "dex", checkType: "evade", damage: "1d4+STR Piercing", range: "30 ft", aiFavor: 1, rank5: "Range 40 ft" },
  { name: "Slingshot", category: "attack", stat: "dex", checkType: "evade", damage: "1d2+STR Bludgeoning", range: "30 ft", aiFavor: 2, twoHanded: true, rank5: "Range +STR score ft" },
];

/** Passive companions to hand-to-hand skills. Choose before the roll; miss = no effect but cooldowns trigger. */
export const DAMAGE_EFFECTS: CatalogSkill[] = [
  { name: "Choke Out", category: "attack", stat: null, checkType: "passive", effect: "(Wrasslin') ×2 total damage vs. targets ≤10% HB", rank5: "≤20% HB" },
  { name: "Iron Punch", category: "attack", stat: null, checkType: "passive", effect: "(Pugilism) +1d2 base damage", rank5: "+1 Rank damage die" },
  { name: "Powerful Strike", category: "attack", stat: null, checkType: "passive", effect: "(Foot Soldier/Noggin Nocker/Pugilism) 30-h cooldown; base-dice result × Rank", rank5: "10-h cooldown" },
  { name: "Skullcracker", category: "attack", stat: null, checkType: "passive", effect: "(Noggin Nocker) +1d4 vs. same-size targets", rank5: "+1d4 more" },
  { name: "Smush", category: "attack", stat: null, checkType: "passive", effect: "(Foot Soldier) vs. ≤20% HB, 1/round; ×2 total damage", rank5: "≤30% HB, ×3" },
  { name: "Toss", category: "attack", stat: null, checkType: "passive", effect: "(Wrasslin') +1d8+STR Bludgeoning, ends Held, throws 5 ft per 5 Ranks; smaller targets only", rank5: "Targets up to your size" },
];

export const UTILITY_SKILLS: CatalogSkill[] = [
  { name: "Aiming", category: "utility", stat: null, checkType: "passive", effect: "Ranged only: add Ranks to attack if you take Disadvantage; on hit +1d4", rank5: "+1d4 more" },
  { name: "Ambush", category: "utility", stat: "int", checkType: "opposed", effect: "Surprise Action before combat; attack with Advantage (unseen)", rank5: "+Ambush Rank damage die on the surprise attack" },
  { name: "Animal Handling", category: "utility", stat: "cha", checkType: "opposed", effect: "Animal won't attack you (book prints CHA stat / INT-Opposed text)", rank5: "Pick an animal type: Advantage vs. it" },
  { name: "Catcher", category: "utility", stat: null, checkType: "passive", effect: "Interrupt: take a direct hit for an adjacent ally (may Step first); can't Evade it", rank5: "+5 DR against it" },
  { name: "Chopper Pilot", category: "utility", stat: "dex", checkType: "unopposed", effect: "Risky riding; Disadvantage attacking while piloting; no 2H weapons", rank5: "Chopper +5 Move" },
  { name: "Climbing", category: "utility", stat: "str", checkType: "unopposed", effect: "Check per minute on dangerous climbs", rank5: "Check every 5 min" },
  { name: "Deception", category: "utility", stat: "cha", checkType: "opposed", effect: "Lie; Disadvantage if target has Detect Lies", rank5: "Usable while gambling" },
  { name: "Detect Lies", category: "utility", stat: "int", checkType: "opposed", effect: "vs. CHA; Disadvantage if you have Deception", rank5: "On Fail, ignore Major-Fail+ side effects" },
  { name: "Detect Trap", category: "utility", stat: "int", checkType: "unopposed", effect: "Find non-magic traps; Disadvantage scanning whole rooms/moving", rank5: "Detects magic traps" },
  { name: "Determine Value", category: "utility", stat: null, checkType: "passive", effect: "Sort Inventory by value (magic-only rank-ups)", rank5: "Type tabs + item history" },
  { name: "Dodge", category: "utility", stat: null, checkType: "passive", effect: "+1 Evade Buff; mark when Evading up to Rank 5", rank5: "Another +1 Evade; +5 ft Step on Evade" },
  { name: "Driving", category: "utility", stat: "dex", checkType: "unopposed", effect: "Stunts; Disadvantage attacking while driving", rank5: "No attack Disadvantage" },
  { name: "Dumpster Diving", category: "utility", stat: "int", checkType: "unopposed", effect: "1 h per 50-ft square: find sought/interesting item", rank5: "+Rank-die of Misc. Junk" },
  { name: "Endurance", category: "utility", stat: "con", checkType: "unopposed", effect: "Avoid Fatigued during grinds/marches", rank5: "Ignore Major Fail effects" },
  { name: "Engineering", category: "utility", stat: "int", checkType: "unopposed", effect: "Build moving-part items from Misc. Junk (no vehicles)", rank5: "Specialize a type: Advantage" },
  { name: "Escape Artist", category: "utility", stat: "dex", checkType: "unopposed", effect: "vs. bonds; STR-Opposed vs. Held", rank5: "Escape unseen + Step" },
  { name: "Explosives Handling", category: "utility", stat: "int", checkType: "unopposed", effect: "Safe handling before a Throwing attack", rank5: "Identify type/status/materials" },
  { name: "Fabricate", category: "utility", stat: "int", checkType: "unopposed", effect: "Non-moving-part items from Misc. Junk", rank5: "Specialize an item: Advantage" },
  { name: "Find Crawler", category: "utility", stat: null, checkType: "passive", effect: "Blue dots for crawlers within 1,000 ft (magic-only rank-ups)", rank5: "5-mile radius" },
  { name: "First Aid", category: "utility", stat: "int", checkType: "unopposed", effect: "Heal 1 HB slot +1 per extra degree; same patient once per short/long rest", rank5: "5 min also cures a Minor Injury" },
  { name: "Goblin Explosives", category: "utility", stat: "int", checkType: "unopposed", effect: "Crit Fail on natural 1–4", rank5: "Crit Fail on ≤3; identify devices" },
  { name: "Good First Impression", category: "utility", stat: "cha", checkType: "opposed", effect: "Non-hostile mob/NPC individual: wary curiosity", rank5: "Lower-level mob won't attack party unless provoked" },
  { name: "Hide in Shadows", category: "utility", stat: "dex", checkType: "opposed", effect: "While still in shadow/cover: Invisible to mobs & HUDs", rank5: "Works in dim light without cover" },
  { name: "Incendiary Device Handling", category: "utility", stat: "int", checkType: "unopposed", effect: "Safe handling", rank5: "Identify devices" },
  { name: "Intimidate", category: "utility", stat: "str", checkType: "opposed", effect: "vs. CHA (Disadvantage if hostilities begun): target Staggered", rank5: "Target flees with remaining Actions" },
  { name: "Investigation", category: "utility", stat: "int", checkType: "unopposed", effect: "10 min (1 Action for Look for Clues): learn something useful", rank5: "Advantage in familiar areas" },
  { name: "Jumping", category: "utility", stat: "str", checkType: "unopposed", effect: "10-ft running start: leap Rank+STR ft, 1 ft high", rank5: "+DEX to height" },
  { name: "Light on Your Feet", category: "utility", stat: "dex", checkType: "unopposed", animalOnly: true, effect: "As Jumping: distance Rank×2 ft, height DEX×2 ft", rank5: "×3 each" },
  { name: "Lockpicking", category: "utility", stat: "dex", checkType: "unopposed", effect: "Takes Floor-Number minutes; Disadvantage without tools", rank5: "Silent, traceless" },
  { name: "Negotiation", category: "utility", stat: "cha", checkType: "opposed", effect: "5 min: price ±10% in your favor (min prices exist)", rank5: "Party shares the price" },
  { name: "Perception", category: "utility", stat: "int", checkType: "unopposed", effect: "Notice things; also Look for Clues", rank5: "Halve clutter penalties" },
  { name: "Performance", category: "utility", stat: "cha", checkType: "unopposed", effect: "+rival's CHA when competing; specialize one type", rank5: "Second specialty" },
  { name: "Persuasion", category: "utility", stat: "cha", checkType: "opposed", effect: "~10 min, safe setting: target complies if not too costly/dangerous/unnatural", rank5: "Only the 'too costly' limit remains" },
  { name: "Regeneration", category: "utility", stat: null, checkType: "passive", effect: "Heal 1 HB slot per round if Rank ≥ CON, else every other round", rank5: "5 min cures Minor Injury, 10 min Major" },
  { name: "Repair", category: "utility", stat: "int", checkType: "unopposed", effect: "2 h: fix simple non-moving-part items", rank5: "Moving parts too" },
  { name: "Running", category: "utility", stat: "dex", checkType: "unopposed", effect: "Per minute (short bursts); +1 per 10 ft Move", rank5: "Check per 2 min; +5 ft Move" },
  { name: "Salvage", category: "utility", stat: "int", checkType: "unopposed", effect: "1 h: recover half raw materials (never explosives)", rank5: "30 min" },
  { name: "Sleight of Hand", category: "utility", stat: "dex", checkType: "opposed", effect: "Hand-size items; Disadvantage if observer's Perception Rank > yours", rank5: "Pickpocket NPCs/mobs" },
  { name: "Stealth", category: "utility", stat: "dex", checkType: "opposed", effect: "Start unseen: stay unnoticed +1 non-Attack Action pre-combat + Step", rank5: "Surprise Action may be an Advantage attack" },
  { name: "Streetwise", category: "utility", stat: "cha", checkType: "unopposed", effect: "Rumors, shady goods, urban navigation", rank5: "+1 bonus rumor" },
  { name: "Survival", category: "utility", stat: "con", checkType: "unopposed", effect: "Avoid hunger/thirst effects in the wilds", rank5: "No extra Crit-Fail damage" },
  { name: "Swimming", category: "utility", stat: "str", checkType: "unopposed", effect: "Per 30 s under pressure; Fatigued after 1 min (or Major Fail)", rank5: "Fatigued after 2 min" },
  { name: "Tactics", category: "utility", stat: "int", checkType: "unopposed", effect: "1/combat; pick Attack/Damage/Evade: party +1 to it, +1 per extra degree", rank5: "Advantage after 5 min observation" },
  { name: "Taunt", category: "utility", stat: "cha", checkType: "opposed", effect: "Interrupt, 30 ft: redirect one attack to you (+1 per extra degree)", rank5: "Free Evade vs. each Taunted attack" },
  { name: "Throwing", category: "utility", stat: "str", checkType: "unopposed", effect: "Up to STR lbs, STR×10 ft; at a foe = Attack vs. Evade; miss scatters 1d8 direction", rank5: "Advantage to willing catchers" },
  { name: "Tracking", category: "utility", stat: "int", checkType: "unopposed", effect: "Find/follow tracks; re-check every 15 min", rank5: "Every 30 min" },
];

export const SKILL_CATALOG: CatalogSkill[] = [...ATTACK_SKILLS, ...DAMAGE_EFFECTS, ...UTILITY_SKILLS];

export function catalogSkill(name: string): CatalogSkill | undefined {
  return SKILL_CATALOG.find((s) => s.name === name);
}
