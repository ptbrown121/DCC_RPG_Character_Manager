import { describe, expect, it } from "vitest";
import {
  statMod,
  deriveFromEnhanced,
  slotsLostToDamage,
  mitigateDamage,
  opposedDifficulty,
  unopposedDifficulty,
  statCheckDifficulty,
  degreeOfSuccess,
  mobHbSlots,
  bossHbSlots,
  statBudget,
  mobSurprise,
  mobEvade,
  damageDiceForLevel,
  typicalMobLevels,
  typicalBossLevels,
  suggestedMobCount,
  hbSlotPercentages,
  creationStatPoints,
  advancementCheckPasses,
  DEBUFFS,
} from "./index";

describe("stat mods (Table 1)", () => {
  it("maps score bands to mods", () => {
    expect(statMod(1)).toBe(1);
    expect(statMod(2)).toBe(1);
    expect(statMod(3)).toBe(2);
    expect(statMod(5)).toBe(2);
    expect(statMod(6)).toBe(3);
    expect(statMod(9)).toBe(3);
    expect(statMod(10)).toBe(4);
    expect(statMod(19)).toBe(4);
    expect(statMod(20)).toBe(5);
    expect(statMod(49)).toBe(5);
    expect(statMod(50)).toBe(6);
    expect(statMod(99)).toBe(6);
    expect(statMod(100)).toBe(7);
    expect(statMod(149)).toBe(7);
    expect(statMod(150)).toBe(8);
    expect(statMod(199)).toBe(8);
    expect(statMod(200)).toBe(9);
    expect(statMod(299)).toBe(9);
    expect(statMod(300)).toBe(10);
    expect(statMod(9999)).toBe(10);
  });
});

describe("derived values", () => {
  const d = deriveFromEnhanced({ str: 6, int: 4, con: 5, dex: 3, cha: 2 });
  it("health = CON Mod × 10 in 10 slots of CON Mod", () => {
    expect(d.hbSlotValue).toBe(2);
    expect(d.maxHealth).toBe(20);
    expect(d.hbSlots).toBe(10);
  });
  it("mana = INT score; evade = DEX mod; lift = STR score × 15", () => {
    expect(d.maxMana).toBe(4);
    expect(d.evadeBonus).toBe(2);
    expect(d.liftLimitLbs).toBe(90);
  });
});

describe("damage application", () => {
  it("damage below one slot's value is lost", () => {
    expect(slotsLostToDamage(3, 4)).toBe(0);
    expect(slotsLostToDamage(4, 4)).toBe(1);
    expect(slotsLostToDamage(10, 4)).toBe(3); // remove slots until removed ≥ damage
  });
  it("mitigation order DR → resist → vulnerable → immune", () => {
    expect(mitigateDamage(15, { dr: 4 })).toBe(11);
    expect(mitigateDamage(15, { dr: 4, resistant: true })).toBe(5);
    expect(mitigateDamage(10, { vulnerable: true })).toBe(20);
    expect(mitigateDamage(100, { immune: true })).toBe(0);
    expect(mitigateDamage(8, { dr: 5, bypassDr: true })).toBe(8); // debuff ticks bypass DR
  });
});

describe("check engine", () => {
  it("difficulty formulas", () => {
    expect(opposedDifficulty(3, 4)).toBe(17);
    expect(unopposedDifficulty(3)).toBe(16);
    expect(statCheckDifficulty(5)).toBe(15);
  });
  it("degrees of success", () => {
    expect(degreeOfSuccess(20, 5, 30)).toBe("critical-hit");
    expect(degreeOfSuccess(1, 40, 10)).toBe("critical-fail");
    expect(degreeOfSuccess(10, 25, 15)).toBe("amazing-success");
    expect(degreeOfSuccess(10, 15, 15)).toBe("success");
    expect(degreeOfSuccess(10, 14, 15)).toBe("near-miss");
    expect(degreeOfSuccess(10, 12, 15)).toBe("fail");
    expect(degreeOfSuccess(10, 5, 15)).toBe("major-fail");
  });
});

describe("adversary math (GM_REFERENCE §2)", () => {
  it("mob HB slots = level, max 10", () => {
    expect(mobHbSlots(6)).toBe(6);
    expect(mobHbSlots(25)).toBe(10);
  });
  it("boss HB slots = severity base + floor (Table 50)", () => {
    expect(bossHbSlots("neighborhood", 3)).toBe(13);
    expect(bossHbSlots("floor", 5)).toBe(45);
  });
  it("stat budgets: mob 1/stat + 3/level; boss 5/stat + severity/level", () => {
    expect(statBudget(6)).toEqual({ base: 1, pool: 18, total: 23 });
    expect(statBudget(25, "city")).toEqual({ base: 5, pool: 125, total: 150 });
  });
  it("surprise 10+INT, evade 10+DEX (mods; +F at the table)", () => {
    expect(mobSurprise(4)).toBe(12); // INT 4 → mod +2
    expect(mobEvade(12)).toBe(14); // DEX 12 → mod +4
  });
  it("Table 51 damage dice and level ranges", () => {
    expect(damageDiceForLevel(3)).toBe(1);
    expect(damageDiceForLevel(25)).toBe(3);
    expect(damageDiceForLevel(80)).toBe(7);
    expect(damageDiceForLevel(300)).toBe(15);
    expect(typicalMobLevels(3)).toEqual([10, 29]);
    expect(typicalBossLevels(3)).toEqual([30, 59]); // next row down
  });
  it("Table 49 encounter sizing", () => {
    expect(suggestedMobCount(4, "moderate")).toBe(4);
    expect(suggestedMobCount(5, "strong")).toBe(8);
    expect(suggestedMobCount(7, "overwhelming")).toBe(14);
    expect(suggestedMobCount(2, "weak")).toBe(1);
  });
  it("HB percentage labels end at exactly 100", () => {
    const p = hbSlotPercentages(6);
    expect(p).toHaveLength(6);
    expect(p[p.length - 1]).toBe(100);
    expect(p[0]).toBe(17);
  });
});

describe("progression", () => {
  it("creation stat points = (level−1)×3", () => {
    expect(creationStatPoints(10)).toBe(27);
    expect(creationStatPoints(1)).toBe(0);
  });
  it("advancement check: d20 ≥ current rank", () => {
    expect(advancementCheckPasses(5, 5)).toBe(true);
    expect(advancementCheckPasses(4, 5)).toBe(false);
  });
});

describe("conditions", () => {
  it("carries the canonical 27-row core debuff table", () => {
    expect(DEBUFFS).toHaveLength(27);
    expect(new Set(DEBUFFS.map((d) => d.name)).size).toBe(27);
  });
});
