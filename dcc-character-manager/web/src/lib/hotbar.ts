// Unified hotbar slot math (plan D6): 10 explicit slots holding spells and
// items, stored in characters.hotbar (migration 0013). Spells are identified
// by name (they live in the character's spells jsonb, which has no ids);
// items by their catalog row id. Pure functions — the UI persists results.

import type { HotbarEntry, SpellRow } from "./types";

export const HOTBAR_SIZE = 10;

/** Always exactly HOTBAR_SIZE entries (pads with null, drops extras). */
export function normalizeHotbar(bar: HotbarEntry[] | null | undefined): HotbarEntry[] {
  const out: HotbarEntry[] = Array.from({ length: HOTBAR_SIZE }, (_, i) => bar?.[i] ?? null);
  return out;
}

/**
 * The one-time client migration off SpellRow.hotlist: an empty bar seeds
 * hotlisted spells (in list order) into the first slots. A bar with any
 * entry is kept as-is — the flag is deprecated once slots exist.
 */
export function seedHotbar(bar: HotbarEntry[] | null | undefined, spells: SpellRow[]): HotbarEntry[] {
  const normalized = normalizeHotbar(bar);
  if (normalized.some((e) => e !== null)) return normalized;
  const seeded = [...normalized];
  let slot = 0;
  for (const sp of spells) {
    if (!sp.hotlist || slot >= HOTBAR_SIZE) continue;
    seeded[slot++] = { type: "spell", id: sp.name };
  }
  return seeded;
}

export function entryKey(e: NonNullable<HotbarEntry>): string {
  return `${e.type}:${e.id}`;
}

/**
 * Drop from a source panel onto a slot: overwrites the occupant; if the same
 * entry already sits elsewhere on the bar, that slot clears (no duplicates).
 */
export function placeEntry(bar: HotbarEntry[], to: number, entry: NonNullable<HotbarEntry>): HotbarEntry[] {
  const next = normalizeHotbar(bar).map((e) =>
    e && entryKey(e) === entryKey(entry) ? null : e,
  );
  next[to] = entry;
  return next;
}

/** Drag between slots: swap (a move onto an empty slot is a swap with null). */
export function swapSlots(bar: HotbarEntry[], a: number, b: number): HotbarEntry[] {
  const next = normalizeHotbar(bar);
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function clearSlot(bar: HotbarEntry[], i: number): HotbarEntry[] {
  const next = normalizeHotbar(bar);
  next[i] = null;
  return next;
}

/** First empty slot, or -1 when the bar is full (★ toggles use this). */
export function firstFreeSlot(bar: HotbarEntry[]): number {
  return normalizeHotbar(bar).findIndex((e) => e === null);
}

/** Index of an entry on the bar, or -1. */
export function findEntry(bar: HotbarEntry[], entry: NonNullable<HotbarEntry>): number {
  return normalizeHotbar(bar).findIndex((e) => e !== null && entryKey(e) === entryKey(entry));
}
