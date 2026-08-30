// Item catalog schema + effect execution (plan D7). Items are GM-authored
// rows (migration 0012); their `effect` jsonb is this discriminated union and
// is only ever executed here — the UI never re-derives item math.
// Sources: RULES_REFERENCE.md §9 (healing/rests), core Table 11 debuffs
// (conditions.ts), loot rarity ladder per the loot-box tiers.

import { debuffByName } from "./conditions";

export const ITEM_KINDS = ["consumable", "bomb", "equipment", "quest", "junk"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "celestial"] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export type ItemEffect =
  /** Restore HB slots (same slot units as the Heal spell / rests). */
  | { kind: "heal_slots"; slots: number }
  | { kind: "restore_mana"; amount: number }
  /** Cure a specific debuff by catalog name, or omit debuffId = "choose one at use". */
  | { kind: "cure_debuff"; debuffId?: string }
  /** Bombs: radius drives the map marker scale (ft → squares via the grid). */
  | { kind: "aoe"; radiusFt: number; note?: string }
  /** GM adjudicates; the app just notifies with the text and decrements. */
  | { kind: "custom"; text: string };

/** The slice of a character that item effects can touch. */
export interface ItemEffectTarget {
  /** Currently filled HB slots. */
  hbSlots: number;
  maxHbSlots: number;
  mana: number;
  maxMana: number;
  /** Active debuff names (duplicates allowed — some debuffs stack). */
  debuffs: string[];
}

export interface ItemEffectOutcome {
  /** Updated copy; equals the input values when nothing changed. */
  target: ItemEffectTarget;
  changed: boolean;
  /** HUD notification line. */
  summary: string;
  /** cure_debuff with no fixed target: the UI must ask which active debuff. */
  needsDebuffChoice?: boolean;
}

const plural = (n: number) => (n === 1 ? "" : "s");

/**
 * Execute an item effect against a character snapshot. Pure — callers persist
 * the returned target (T11) and show `summary` on the HUD. Rules honored:
 * The Taint blocks all healing; healing ≥1 slot clears Dying (Table 11).
 */
export function applyItemEffect(target: ItemEffectTarget, effect: ItemEffect): ItemEffectOutcome {
  switch (effect.kind) {
    case "heal_slots": {
      if (target.debuffs.includes("The Taint")) {
        return { target, changed: false, summary: "The Taint prevents all healing. Sucks to be you." };
      }
      const restored = Math.max(0, Math.min(target.maxHbSlots - target.hbSlots, effect.slots));
      if (restored === 0) {
        return { target, changed: false, summary: "Health Bar already full." };
      }
      const clearsDying = target.debuffs.includes("Dying");
      return {
        target: {
          ...target,
          hbSlots: target.hbSlots + restored,
          debuffs: clearsDying ? removeFirst(target.debuffs, "Dying") : target.debuffs,
        },
        changed: true,
        summary: `Restored ${restored} HB slot${plural(restored)}.${clearsDying ? " No longer Dying." : ""}`,
      };
    }
    case "restore_mana": {
      const restored = Math.max(0, Math.min(target.maxMana - target.mana, effect.amount));
      if (restored === 0) {
        return { target, changed: false, summary: "Mana already full." };
      }
      return {
        target: { ...target, mana: target.mana + restored },
        changed: true,
        summary: `Restored ${restored} Mana.`,
      };
    }
    case "cure_debuff": {
      if (!effect.debuffId) {
        return { target, changed: false, summary: "Choose a debuff to cure.", needsDebuffChoice: true };
      }
      if (!debuffByName(effect.debuffId)) {
        return { target, changed: false, summary: `Unknown debuff “${effect.debuffId}” — nothing happens.` };
      }
      if (!target.debuffs.includes(effect.debuffId)) {
        return { target, changed: false, summary: `No ${effect.debuffId} to cure.` };
      }
      // Remove one application — stackable debuffs (Poisoned…) cure one at a time.
      return {
        target: { ...target, debuffs: removeFirst(target.debuffs, effect.debuffId) },
        changed: true,
        summary: `Cured: ${effect.debuffId}.`,
      };
    }
    case "aoe":
      return {
        target,
        changed: false,
        summary: `Deploy on the tactical map — ${effect.radiusFt} ft blast radius.${effect.note ? ` ${effect.note}` : ""}`,
      };
    case "custom":
      return { target, changed: false, summary: effect.text };
  }
}

function removeFirst(list: string[], name: string): string[] {
  const i = list.indexOf(name);
  return i === -1 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
}

/**
 * Map an effect outcome's debuff name-list back onto the character's debuff
 * rows, preserving row extras (notes) and duplicate stacking: each name claims
 * the first unclaimed row with that name; names with no row become bare rows.
 */
export function reconcileDebuffRows<T extends { name: string }>(
  rows: T[],
  names: string[],
): (T | { name: string })[] {
  const pool = [...rows];
  return names.map((n) => {
    const i = pool.findIndex((r) => r.name === n);
    return i >= 0 ? pool.splice(i, 1)[0] : { name: n };
  });
}

/** One-line effect description for tooltips, the item editor, and inventory rows. */
export function describeItemEffect(effect: ItemEffect | null | undefined): string {
  if (!effect) return "No mechanical effect.";
  switch (effect.kind) {
    case "heal_slots":
      return `Restores ${effect.slots} HB slot${plural(effect.slots)}.`;
    case "restore_mana":
      return `Restores ${effect.amount} Mana.`;
    case "cure_debuff":
      return effect.debuffId ? `Cures: ${effect.debuffId}.` : "Cures one debuff of your choice.";
    case "aoe":
      return `${effect.radiusFt} ft blast radius on the map.${effect.note ? ` ${effect.note}` : ""}`;
    case "custom":
      return effect.text;
  }
}
