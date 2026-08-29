import { describe, expect, it } from "vitest";
import {
  defaultCollapseDays,
  floorTotalHours,
  hoursRemaining,
  formatDungeonTime,
  AREA_SECTIONS,
  DEFAULT_JANITORS,
} from "./campaign";

describe("campaign structure", () => {
  it("floor collapse defaults match the book (F1–F5: 5/6/8/10/15 days)", () => {
    expect([1, 2, 3, 4, 5].map(defaultCollapseDays)).toEqual([5, 6, 8, 10, 15]);
  });
  it("clock math uses 30-hour dungeon days", () => {
    expect(floorTotalHours(5)).toBe(150);
    expect(hoursRemaining(5, 40)).toBe(110);
    expect(hoursRemaining(5, 999)).toBe(0);
    expect(formatDungeonTime(110)).toBe("3d 20h");
    expect(formatDungeonTime(20)).toBe("20h");
  });
  it("template has 11 text sections + bosses + NPCs = 13 parts", () => {
    expect(AREA_SECTIONS).toHaveLength(11);
    expect(AREA_SECTIONS.find((s) => s.key === "quarters")?.questLabel).toBe("Quest Stages");
  });
  it("known janitors are seeded", () => {
    expect(DEFAULT_JANITORS[3]).toBe("Street Urchins");
    expect(DEFAULT_JANITORS[4]).toBe("Jikininki Ghoul");
  });
});
