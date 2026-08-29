import { describe, expect, it } from "vitest";
import {
  RACE_BUILD_POINTS,
  CLASS_BUILD_POINTS,
  MAX_DETRIMENT_BP,
  BENEFIT_COST,
  BUILD_BENEFITS,
  BUILD_DETRIMENTS,
  detrimentBpForPenaltyPoints,
} from "./raceclass";
import { ALL_RACES, ALL_CLASSES } from "./raceclassData";

describe("point build system", () => {
  it("has the book budgets (25 race / 30 class, +5 detriment cap)", () => {
    expect(RACE_BUILD_POINTS).toBe(25);
    expect(CLASS_BUILD_POINTS).toBe(30);
    expect(MAX_DETRIMENT_BP).toBe(5);
  });
  it("prices tiers 1/2/3/4/6", () => {
    expect([BENEFIT_COST.minor, BENEFIT_COST.moderate, BENEFIT_COST.major, BENEFIT_COST.extreme, BENEFIT_COST.epic]).toEqual([1, 2, 3, 4, 6]);
  });
  it("benefit and detriment menus are populated with unique labels", () => {
    expect(BUILD_BENEFITS.length).toBeGreaterThan(60);
    expect(new Set(BUILD_BENEFITS.map((b) => b.label)).size).toBe(BUILD_BENEFITS.length);
    expect(BUILD_DETRIMENTS.length).toBeGreaterThan(15);
    for (const d of BUILD_DETRIMENTS) expect([1, 2, 3]).toContain(d.bp);
  });
  it("stat/skill penalties refund 1 BP per 2 points", () => {
    expect(detrimentBpForPenaltyPoints(4)).toBe(2);
    expect(detrimentBpForPenaltyPoints(3)).toBe(1);
    expect(detrimentBpForPenaltyPoints(0)).toBe(0);
  });
});

describe("race & class catalogs", () => {
  it("are populated with unique names", () => {
    expect(ALL_RACES.length).toBeGreaterThanOrEqual(20);
    expect(ALL_CLASSES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ALL_RACES.map((r) => r.name)).size).toBe(ALL_RACES.length);
    expect(new Set(ALL_CLASSES.map((c) => c.name)).size).toBe(ALL_CLASSES.length);
  });
  it("every entry has valid stat keys and non-negative ranks", () => {
    const validKeys = new Set(["str", "int", "con", "dex", "cha"]);
    for (const e of [...ALL_RACES, ...ALL_CLASSES]) {
      for (const k of Object.keys(e.statBonuses)) expect(validKeys.has(k)).toBe(true);
      for (const g of e.skillGrants) expect(g.ranks).toBeGreaterThanOrEqual(0);
    }
  });
  it("races are earth or alien", () => {
    for (const r of ALL_RACES) expect(["earth", "alien"]).toContain(r.kind);
  });
});
