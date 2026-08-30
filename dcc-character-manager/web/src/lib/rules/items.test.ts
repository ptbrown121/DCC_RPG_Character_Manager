import { describe, expect, it } from "vitest";
import { applyItemEffect, describeItemEffect, reconcileDebuffRows, type ItemEffectTarget } from "./items";

const base: ItemEffectTarget = {
  hbSlots: 4,
  maxHbSlots: 10,
  mana: 3,
  maxMana: 12,
  debuffs: [],
};

describe("applyItemEffect / heal_slots", () => {
  it("restores slots up to the requested amount", () => {
    const out = applyItemEffect(base, { kind: "heal_slots", slots: 2 });
    expect(out.target.hbSlots).toBe(6);
    expect(out.changed).toBe(true);
    expect(out.summary).toBe("Restored 2 HB slots.");
  });

  it("clamps at the HB maximum", () => {
    const out = applyItemEffect({ ...base, hbSlots: 9 }, { kind: "heal_slots", slots: 5 });
    expect(out.target.hbSlots).toBe(10);
    expect(out.summary).toBe("Restored 1 HB slot.");
  });

  it("does nothing at full health", () => {
    const full = { ...base, hbSlots: 10 };
    const out = applyItemEffect(full, { kind: "heal_slots", slots: 2 });
    expect(out.changed).toBe(false);
    expect(out.target).toBe(full);
    expect(out.summary).toMatch(/already full/);
  });

  it("is blocked entirely by The Taint", () => {
    const tainted = { ...base, hbSlots: 1, debuffs: ["The Taint"] };
    const out = applyItemEffect(tainted, { kind: "heal_slots", slots: 5 });
    expect(out.changed).toBe(false);
    expect(out.target.hbSlots).toBe(1);
    expect(out.summary).toMatch(/Taint/);
  });

  it("clears Dying when at least one slot is restored", () => {
    const dying = { ...base, hbSlots: 0, debuffs: ["Dying", "Poisoned"] };
    const out = applyItemEffect(dying, { kind: "heal_slots", slots: 2 });
    expect(out.target.hbSlots).toBe(2);
    expect(out.target.debuffs).toEqual(["Poisoned"]);
    expect(out.summary).toMatch(/No longer Dying/);
  });
});

describe("applyItemEffect / restore_mana", () => {
  it("restores mana up to the requested amount", () => {
    const out = applyItemEffect(base, { kind: "restore_mana", amount: 5 });
    expect(out.target.mana).toBe(8);
    expect(out.summary).toBe("Restored 5 Mana.");
  });

  it("clamps at max mana and no-ops when full", () => {
    expect(applyItemEffect({ ...base, mana: 10 }, { kind: "restore_mana", amount: 5 }).target.mana).toBe(12);
    const full = applyItemEffect({ ...base, mana: 12 }, { kind: "restore_mana", amount: 5 });
    expect(full.changed).toBe(false);
    expect(full.summary).toMatch(/already full/);
  });
});

describe("applyItemEffect / cure_debuff", () => {
  it("removes one application of a stackable debuff", () => {
    const sick = { ...base, debuffs: ["Poisoned", "Poisoned", "Burned"] };
    const out = applyItemEffect(sick, { kind: "cure_debuff", debuffId: "Poisoned" });
    expect(out.target.debuffs).toEqual(["Poisoned", "Burned"]);
    expect(out.changed).toBe(true);
    expect(out.summary).toBe("Cured: Poisoned.");
  });

  it("no-ops when the debuff is not active", () => {
    const out = applyItemEffect(base, { kind: "cure_debuff", debuffId: "Burned" });
    expect(out.changed).toBe(false);
    expect(out.summary).toBe("No Burned to cure.");
  });

  it("rejects names outside the 27-debuff catalog gracefully", () => {
    const out = applyItemEffect({ ...base, debuffs: ["Cooties"] }, { kind: "cure_debuff", debuffId: "Cooties" });
    expect(out.changed).toBe(false);
    expect(out.target.debuffs).toEqual(["Cooties"]);
    expect(out.summary).toMatch(/Unknown debuff/);
  });

  it("asks for a choice when no debuff is specified", () => {
    const out = applyItemEffect({ ...base, debuffs: ["Burned"] }, { kind: "cure_debuff" });
    expect(out.needsDebuffChoice).toBe(true);
    expect(out.changed).toBe(false);
  });
});

describe("applyItemEffect / aoe and custom", () => {
  it("aoe never touches the character and points at the map", () => {
    const out = applyItemEffect(base, { kind: "aoe", radiusFt: 20, note: "Goblin shrapnel." });
    expect(out.changed).toBe(false);
    expect(out.target).toEqual(base);
    expect(out.summary).toBe("Deploy on the tactical map — 20 ft blast radius. Goblin shrapnel.");
  });

  it("custom just surfaces the GM's text", () => {
    const out = applyItemEffect(base, { kind: "custom", text: "You feel watched." });
    expect(out.changed).toBe(false);
    expect(out.summary).toBe("You feel watched.");
  });
});

describe("reconcileDebuffRows", () => {
  it("preserves row notes and removes exactly the cured instance", () => {
    const rows = [
      { name: "Poisoned", note: "spider bite" },
      { name: "Poisoned", note: "bad shrimp" },
      { name: "Burned" },
    ];
    const out = reconcileDebuffRows(rows, ["Poisoned", "Burned"]);
    expect(out).toEqual([{ name: "Poisoned", note: "spider bite" }, { name: "Burned" }]);
  });

  it("creates bare rows for names without a match", () => {
    expect(reconcileDebuffRows([{ name: "Burned", note: "x" }], ["Burned", "Dying"])).toEqual([
      { name: "Burned", note: "x" },
      { name: "Dying" },
    ]);
  });

  it("empty names → empty rows", () => {
    expect(reconcileDebuffRows([{ name: "Burned" }], [])).toEqual([]);
  });
});

describe("describeItemEffect", () => {
  it("covers every effect kind and the null case", () => {
    expect(describeItemEffect(null)).toBe("No mechanical effect.");
    expect(describeItemEffect({ kind: "heal_slots", slots: 1 })).toBe("Restores 1 HB slot.");
    expect(describeItemEffect({ kind: "heal_slots", slots: 2 })).toBe("Restores 2 HB slots.");
    expect(describeItemEffect({ kind: "restore_mana", amount: 4 })).toBe("Restores 4 Mana.");
    expect(describeItemEffect({ kind: "cure_debuff", debuffId: "Poisoned" })).toBe("Cures: Poisoned.");
    expect(describeItemEffect({ kind: "cure_debuff" })).toBe("Cures one debuff of your choice.");
    expect(describeItemEffect({ kind: "aoe", radiusFt: 20 })).toBe("20 ft blast radius on the map.");
    expect(describeItemEffect({ kind: "custom", text: "Smells weird." })).toBe("Smells weird.");
  });
});
