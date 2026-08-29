import { describe, expect, it } from "vitest";
import {
  LOOT_TIERS,
  LOOT_BOX_TYPES,
  BOSS_BOX,
  VEHICLE_HB_SLOTS,
  vehicleExplosion,
  ramDice,
  SAMPLE_VEHICLES,
  tamingDifficulty,
  petLevelStep,
  PET_MATURE_LEVEL,
  mountHbSlots,
  PET_ATTITUDES,
} from "./assets";

describe("loot boxes", () => {
  it("six tiers, Bronze → Celestial", () => {
    expect(LOOT_TIERS).toHaveLength(6);
    expect(LOOT_TIERS[0]).toBe("Bronze");
    expect(LOOT_TIERS[5]).toBe("Celestial");
  });
  it("boss tier → box tier mapping is 1:1 up the ladder", () => {
    expect(BOSS_BOX.neighborhood).toBe("Bronze");
    expect(BOSS_BOX.city).toBe("Gold");
    expect(BOSS_BOX.floor).toBe("Celestial");
  });
  it("box types are unique", () => {
    expect(new Set(LOOT_BOX_TYPES).size).toBe(LOOT_BOX_TYPES.length);
  });
});

describe("vehicles", () => {
  it("10 HB slots; explosion = (size)d6+F Fire", () => {
    expect(VEHICLE_HB_SLOTS).toBe(10);
    expect(vehicleExplosion(6, 4)).toBe("6d6+4 Fire");
  });
  it("ram dice = size + Move÷10 (book example: size 4 at Move 50 → 9d6)", () => {
    expect(ramDice(4, 50)).toBe(9);
    expect(ramDice(2, 30)).toBe(5);
  });
  it("Table 7 sample vehicles present with sane stats", () => {
    expect(SAMPLE_VEHICLES).toHaveLength(8);
    const tank = SAMPLE_VEHICLES.find((v) => v.name === "Tank")!;
    expect(tank.dr).toBe(10);
    const moto = SAMPLE_VEHICLES.find((v) => v.name === "Motorcycle")!;
    expect(moto.move).toBe(120);
  });
});

describe("companions", () => {
  it("taming difficulty = 10 + INT Mod + Floor", () => {
    expect(tamingDifficulty(2, 3)).toBe(15);
  });
  it("pets level +2 at a time until mature at 15, then +1", () => {
    expect(petLevelStep(1)).toBe(2);
    expect(petLevelStep(13)).toBe(2);
    expect(petLevelStep(PET_MATURE_LEVEL)).toBe(1);
  });
  it("mount HB slots = size; attitude ladder has 4 rungs ending Bonded", () => {
    expect(mountHbSlots(5)).toBe(5);
    expect(PET_ATTITUDES).toHaveLength(4);
    expect(PET_ATTITUDES[3].value).toBe("bonded");
  });
});
