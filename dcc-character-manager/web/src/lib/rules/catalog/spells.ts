// Starter-set spell catalog (mechanical data): Crawlers & Customization pp. 36–41.
// Attack spells roll vs. Evade and add INT to base damage; spells can't be used
// untrained (except scrolls) and must be in the Hotlist to cast in combat.

export interface CatalogSpell {
  name: string;
  type: "attack" | "passive" | "interrupt";
  mana: number;
  range: string;
  /** Terse mechanics: base damage for attacks, effect for others. */
  effect: string;
  aiFavor?: number;
  duration?: string;
  cooldown?: string;
  aoe?: string;
  /** Rank 5 upgrade, terse. Attack R5s add +1 base damage die unless noted. */
  rank5?: string;
  /** Legal picks for the creation-time "spell instead of weapon" option (needs INT 4+). */
  starterOption?: boolean;
}

export const SPELL_CATALOG: CatalogSpell[] = [
  { name: "Astral Paw", type: "passive", mana: 12, range: "30 ft", effect: "Spectral hand manipulates objects (skill checks at Disadvantage)", duration: "5 min / end of combat", rank5: "Pugilism & Slice via paw add Rank die" },
  { name: "Confusing Fog", type: "passive", mana: 6, range: "40 ft", effect: "25×25 ft fog; party sees through; mobs attack in at Disadvantage", duration: "2 rounds / 20 s", cooldown: "15 min", rank5: "50×50 ft, 1 min" },
  { name: "Dirt Clod", type: "attack", mana: 1, range: "100 ft", effect: "1d2+INT Bludgeoning", aiFavor: 2, rank5: "+2d2 instead of +1 die", starterOption: true },
  { name: "Drain Life", type: "attack", mana: 14, range: "30 ft", effect: "1d6+INT Necrotic", rank5: "Target loses ≥3 slots → you heal 1" },
  { name: "Fireball", type: "attack", mana: 45, range: "80 ft", effect: "1d12+INT Fire; roll at Disadvantage (slow); miss scatters 1d8 × missed-by ft", aoe: "10-ft Blast", cooldown: "1/scene", rank5: "Targets losing ≥1 slot are Burned" },
  { name: "Fire Fingers", type: "attack", mana: 3, range: "Melee", effect: "1d4+INT Fire", aiFavor: 1, starterOption: true },
  { name: "Frost Scar", type: "attack", mana: 2, range: "Melee", effect: "1d4+INT Ice", aiFavor: 1, rank5: "Target can't self-heal next round", starterOption: true },
  { name: "Heal", type: "interrupt", mana: 2, range: "Self", effect: "Heal 2 HB slots; self only; Rank 1 max; every crawler has it", rank5: "No upgrades" },
  { name: "Heal Others", type: "interrupt", mana: 6, range: "30 ft", effect: "Heal 1d4 HB slots; not on self", rank5: "Heals 1d6 instead" },
  { name: "Hole", type: "passive", mana: 12, range: "10 ft", effect: "2-ft-diameter hole, 1 inch deep per Rank; not on saferoom doors/living things", duration: "5 min", rank5: "Shrinkable diameter" },
  { name: "Ice Blast", type: "attack", mana: 9, range: "40 ft", effect: "1d8+INT Ice" },
  { name: "Lightning Bolt", type: "attack", mana: 15, range: "100 ft", effect: "1d10+INT Electric" },
  { name: "Magic Missile", type: "attack", mana: 5, range: "Line of sight", effect: "1d4+INT Force", aiFavor: 1, rank5: "Variable cast: 3 Mana −4 dmg / 4 Mana −2 / 6 Mana +Rank die" },
  { name: "Protective Shell", type: "interrupt", mana: 0, range: "Self", effect: "(10+INT)-ft shell; pushes mobs out; blocks physical entry/attacks; immobile; imbued on worn item", duration: "5 s", cooldown: "30 h", rank5: "10 s; blocks all non-Spell outside attacks until round-end" },
  { name: "Puddle Jumper", type: "passive", mana: 20, range: "Line of sight", effect: "Teleport self + up to 3 party members; 10-s delay; surface destination", cooldown: "5 h", rank5: "2-s delay; any destination" },
  { name: "Second Chance", type: "passive", mana: 10, range: "10 ft", effect: "Raise lower-level mob as Undead Minion at half HB; 1 Action to command", duration: "1 min", rank5: "Mob up to +5 levels; 5 min" },
  { name: "Shield", type: "interrupt", mana: 8, range: "Self", effect: "Force field with 2 HB slots (CON Mod each) absorbing damage first; unhealable", duration: "5 min", rank5: "5 HB slots" },
  { name: "Shock Treatment", type: "attack", mana: 2, range: "30 ft", effect: "1d2+INT Electric", aiFavor: 2, rank5: "May inflict Stunned instead of damage", starterOption: true },
  { name: "Soul Collector", type: "attack", mana: 4, range: "50 ft", effect: "1d4+INT Necrotic", aiFavor: 1, rank5: "Killing blows (foe ≥ half your level) grant cumulative +1 dmg until long rest, max = Rank", starterOption: true },
  { name: "Thunderlash", type: "attack", mana: 12, range: "50 ft", effect: "1d10+INT Sonic" },
  { name: "Torch", type: "passive", mana: 1, range: "Self", effect: "Light orb: 20-ft bright + 20-ft dim", duration: "Until saferoom / new floor", rank5: "Orb movable 20 ft away" },
  { name: "Unnecessary Force", type: "attack", mana: 13, range: "40 ft", effect: "1d12+INT Force" },
  { name: "Wisp Armor", type: "passive", mana: 5, range: "Self", effect: "Incoming magic damage reduced to its Rank-1 base; mind-control immunity", duration: "5 min", cooldown: "5 min", rank5: "10 min" },
];

export function catalogSpell(name: string): CatalogSpell | undefined {
  return SPELL_CATALOG.find((s) => s.name === name);
}

/** Creation option: one low-cost attack spell instead of a weapon (requires INT 4+). */
export const STARTER_SPELLS = SPELL_CATALOG.filter((s) => s.starterOption).map((s) => s.name);
