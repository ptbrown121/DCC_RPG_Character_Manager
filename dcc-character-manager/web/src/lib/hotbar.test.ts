import { describe, expect, it } from "vitest";
import {
  HOTBAR_SIZE,
  clearSlot,
  findEntry,
  firstFreeSlot,
  normalizeHotbar,
  placeEntry,
  seedHotbar,
  swapSlots,
} from "./hotbar";
import type { HotbarEntry, SpellRow } from "./types";

const spell = (id: string): NonNullable<HotbarEntry> => ({ type: "spell", id });
const item = (id: string): NonNullable<HotbarEntry> => ({ type: "item", id });

const spellRow = (name: string, hotlist: boolean): SpellRow => ({ name, mana: 2, rank: 1, hotlist });

describe("normalizeHotbar", () => {
  it("pads short/absent bars to 10 and truncates long ones", () => {
    expect(normalizeHotbar(undefined)).toHaveLength(HOTBAR_SIZE);
    expect(normalizeHotbar([])).toEqual(Array(10).fill(null));
    expect(normalizeHotbar([spell("Heal")])[0]).toEqual(spell("Heal"));
    expect(normalizeHotbar(Array(15).fill(null))).toHaveLength(HOTBAR_SIZE);
  });
});

describe("seedHotbar", () => {
  it("seeds hotlisted spells in order into the first slots of an empty bar", () => {
    const bar = seedHotbar([], [spellRow("Heal", true), spellRow("Zap", false), spellRow("Fireball", true)]);
    expect(bar[0]).toEqual(spell("Heal"));
    expect(bar[1]).toEqual(spell("Fireball"));
    expect(bar[2]).toBeNull();
  });

  it("leaves a bar with any entry untouched (flag is deprecated after seeding)", () => {
    const existing = placeEntry(normalizeHotbar([]), 4, item("potion"));
    const bar = seedHotbar(existing, [spellRow("Heal", true)]);
    expect(bar[0]).toBeNull();
    expect(bar[4]).toEqual(item("potion"));
  });

  it("stops seeding at 10 hotlisted spells", () => {
    const many = Array.from({ length: 12 }, (_, i) => spellRow(`S${i}`, true));
    const bar = seedHotbar([], many);
    expect(bar).toHaveLength(10);
    expect(bar[9]).toEqual(spell("S9"));
  });
});

describe("placeEntry", () => {
  it("overwrites the target slot", () => {
    let bar = placeEntry(normalizeHotbar([]), 3, item("potion"));
    bar = placeEntry(bar, 3, spell("Heal"));
    expect(bar[3]).toEqual(spell("Heal"));
  });

  it("dedupes: the same entry dropped on a new slot leaves its old slot", () => {
    let bar = placeEntry(normalizeHotbar([]), 1, item("potion"));
    bar = placeEntry(bar, 7, item("potion"));
    expect(bar[1]).toBeNull();
    expect(bar[7]).toEqual(item("potion"));
    expect(bar.filter(Boolean)).toHaveLength(1);
  });

  it("same id under different types are distinct entries", () => {
    let bar = placeEntry(normalizeHotbar([]), 0, spell("x"));
    bar = placeEntry(bar, 1, item("x"));
    expect(bar[0]).toEqual(spell("x"));
    expect(bar[1]).toEqual(item("x"));
  });
});

describe("swapSlots / clearSlot / lookups", () => {
  it("swaps occupied and empty slots", () => {
    let bar = placeEntry(normalizeHotbar([]), 0, spell("Heal"));
    bar = placeEntry(bar, 1, item("potion"));
    bar = swapSlots(bar, 0, 1);
    expect(bar[0]).toEqual(item("potion"));
    expect(bar[1]).toEqual(spell("Heal"));
    bar = swapSlots(bar, 0, 5);
    expect(bar[0]).toBeNull();
    expect(bar[5]).toEqual(item("potion"));
  });

  it("clearSlot empties exactly one slot", () => {
    let bar = placeEntry(normalizeHotbar([]), 2, spell("Heal"));
    bar = clearSlot(bar, 2);
    expect(bar).toEqual(Array(10).fill(null));
  });

  it("firstFreeSlot and findEntry", () => {
    let bar = normalizeHotbar([]);
    expect(firstFreeSlot(bar)).toBe(0);
    bar = placeEntry(bar, 0, spell("Heal"));
    expect(firstFreeSlot(bar)).toBe(1);
    expect(findEntry(bar, spell("Heal"))).toBe(0);
    expect(findEntry(bar, item("potion"))).toBe(-1);
    const full = Array.from({ length: 10 }, (_, i) => spell(`S${i}`));
    expect(firstFreeSlot(full)).toBe(-1);
  });
});
