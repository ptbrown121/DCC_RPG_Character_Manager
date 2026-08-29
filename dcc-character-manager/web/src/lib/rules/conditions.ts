// Debuff catalog (mechanical summaries keyed to core rulebook Table 11, p. 97 —
// the canonical 27-row list). "F" = current Floor Number. Debuff damage ticks at
// end of round and bypasses DR (resistances/immunities still apply).

export interface DebuffDef {
  name: string;
  /** Terse mechanical effect. */
  effect: string;
  /** Terse default duration. */
  duration: string;
  stackable?: boolean;
  /** End-of-round damage formula, if any, as {dice, die, plusFloor}. */
  tick?: { dice: number; die: number; plusFloor: boolean; type?: string };
}

export const DEBUFFS: DebuffDef[] = [
  { name: "Blinded", effect: "Disadvantage on sight-based checks", duration: "End of next round" },
  { name: "Blood Trail", effect: "1d6+F dmg end of round", duration: "Until bandage / First Aid", stackable: true, tick: { dice: 1, die: 6, plusFloor: true } },
  { name: "Burned", effect: "1d10+F Fire dmg end of round", duration: "End of combat / 5 min; DEX Stat Check to extinguish", tick: { dice: 1, die: 10, plusFloor: true, type: "Fire" } },
  { name: "Drowning", effect: "1d6+F dmg end of round", duration: "Until head above water", tick: { dice: 1, die: 6, plusFloor: true } },
  { name: "Dying", effect: "At 0% HB; countdown = CON Mod, −1 each round and per damage instance", duration: "Until death or ≥1 HB slot healed" },
  { name: "Enraged", effect: "Attack and Move Actions only", duration: "2 rounds / 20 s" },
  { name: "Fatigued", effect: "−1 all checks; Move halved", duration: "Until long rest", stackable: true },
  { name: "Held", effect: "No Move/Step (may still Evade); attacks vs. you have Advantage", duration: "Until escape (STR-Opposed Escape Artist; Unopposed if not physically held)" },
  { name: "Long-Term Major Injury", effect: "−5 all checks", duration: "Full day's rest" },
  { name: "Long-Term Minor Injury", effect: "−2 all checks", duration: "Long rest" },
  { name: "Major Injury", effect: "−5 all checks; second one → Long-Term", duration: "Long rest" },
  { name: "Minor Injury", effect: "−2 all checks; second one → Long-Term", duration: "Short rest" },
  { name: "Muted", effect: "No speech or Spells", duration: "End of combat / 5 min" },
  { name: "Paralyzed", effect: "No Actions", duration: "End of next round" },
  { name: "Poisoned", effect: "1d8+F Poison dmg end of round", duration: "Until antidote", stackable: true, tick: { dice: 1, die: 8, plusFloor: true, type: "Poison" } },
  { name: "Queasy", effect: "Next rolled Action at Disadvantage", duration: "End of next Action" },
  { name: "Sepsis", effect: "Staggered + 1d10+F Poison dmg per round", duration: "Until healed", tick: { dice: 1, die: 10, plusFloor: true, type: "Poison" } },
  { name: "Shit-Faced", effect: "All checks at Disadvantage", duration: "10 min" },
  { name: "Shocked", effect: "Lose next Action", duration: "Once forfeited" },
  { name: "Sore as Shit", effect: "−1 all rolls", duration: "1 hour" },
  { name: "Staggered", effect: "Next Action can't be Move; attack at Disadvantage; no Step", duration: "End of next Action" },
  { name: "Stiff Legs", effect: "No 10-ft Steps", duration: "End of combat / 5 min" },
  { name: "Stunned", effect: "Disadvantage on next check", duration: "Once a check is made" },
  { name: "Take Down", effect: "Prone; attacks vs. you have Advantage", duration: "Stand with a 10-ft Step" },
  { name: "Terrified", effect: "No Move/Steps; attacks at Disadvantage", duration: "End of next round or take ≥1 slot dmg" },
  { name: "The Taint", effect: "Can't be healed", duration: "End of combat / 5 min" },
  { name: "Woozy", effect: "No DEX Mod on Attack/Evade checks", duration: "End of next round" },
];

export const DEBUFF_NAMES = DEBUFFS.map((d) => d.name);

export function debuffByName(name: string): DebuffDef | undefined {
  return DEBUFFS.find((d) => d.name === name);
}
