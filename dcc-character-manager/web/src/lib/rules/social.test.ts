import { describe, expect, it } from "vitest";
import {
  WORSHIP_TIERS,
  BOON_STREAK_DAYS,
  FAN_BOX_MILESTONES,
  MAX_SPONSORS,
  nextFanBox,
  SAFE_GRIND_HOURS_PER_DAY,
  grindCheckReady,
  grindLevelReady,
} from "./social";

describe("worship & popularity constants", () => {
  it("tithes are 5/10/20% across the three tiers", () => {
    expect(WORSHIP_TIERS.map((t) => t.tithePct)).toEqual([5, 10, 20]);
    expect(BOON_STREAK_DAYS).toBe(5);
  });
  it("fan boxes at 25/50/100; max 3 sponsors", () => {
    expect([...FAN_BOX_MILESTONES]).toEqual([25, 50, 100]);
    expect(MAX_SPONSORS).toBe(3);
    expect(nextFanBox(0)).toBe(25);
    expect(nextFanBox(25)).toBe(50);
    expect(nextFanBox(150)).toBeNull();
  });
});

describe("grinding", () => {
  it("5 safe hours per day", () => {
    expect(SAFE_GRIND_HOURS_PER_DAY).toBe(5);
  });
  it("skill check ready when hours reach current rank (rank ≥1)", () => {
    expect(grindCheckReady(3, 3)).toBe(true);
    expect(grindCheckReady(2, 3)).toBe(false);
    expect(grindCheckReady(5, 0)).toBe(false);
  });
  it("level-up when total grind hours reach current level", () => {
    expect(grindLevelReady(12, 12)).toBe(true);
    expect(grindLevelReady(11, 12)).toBe(false);
  });
});
