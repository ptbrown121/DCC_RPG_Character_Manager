import { describe, expect, it } from "vitest";
import { ATTACK_SKILLS, DAMAGE_EFFECTS, UTILITY_SKILLS, SKILL_CATALOG, catalogSkill } from "./skills";
import { SPELL_CATALOG, STARTER_SPELLS, catalogSpell } from "./spells";

describe("skill catalog", () => {
  it("has the full starter-set tables (23 attack + 46 utility + 6 damage effects)", () => {
    expect(ATTACK_SKILLS).toHaveLength(23);
    expect(UTILITY_SKILLS).toHaveLength(46);
    expect(DAMAGE_EFFECTS).toHaveLength(6);
  });
  it("has unique names", () => {
    expect(new Set(SKILL_CATALOG.map((s) => s.name)).size).toBe(SKILL_CATALOG.length);
  });
  it("attack skills all target Evade and carry damage; passives have no stat", () => {
    for (const s of ATTACK_SKILLS) {
      expect(s.checkType).toBe("evade");
      expect(s.damage).toBeTruthy();
    }
    for (const s of SKILL_CATALOG.filter((x) => x.checkType === "passive")) {
      expect(s.stat).toBeNull();
    }
  });
  it("hand-to-hand pairings reference real damage effects", () => {
    const effectNames = new Set(DAMAGE_EFFECTS.map((d) => d.name));
    for (const s of ATTACK_SKILLS.filter((x) => x.damageEffects)) {
      for (const e of s.damageEffects!) expect(effectNames.has(e)).toBe(true);
    }
    expect(catalogSkill("Wrasslin'")?.damageEffects).toEqual(["Choke Out", "Toss"]);
  });
});

describe("spell catalog", () => {
  it("has the 23 starter-set spells with unique names", () => {
    expect(SPELL_CATALOG).toHaveLength(23);
    expect(new Set(SPELL_CATALOG.map((s) => s.name)).size).toBe(23);
  });
  it("everyone's Heal is present and correct", () => {
    const heal = catalogSpell("Heal");
    expect(heal?.mana).toBe(2);
    expect(heal?.type).toBe("interrupt");
  });
  it("the five starter attack-spell options are flagged", () => {
    expect(new Set(STARTER_SPELLS)).toEqual(
      new Set(["Dirt Clod", "Fire Fingers", "Frost Scar", "Shock Treatment", "Soul Collector"]),
    );
    for (const n of STARTER_SPELLS) expect(catalogSpell(n)?.type).toBe("attack");
  });
});
