// Core stat definitions and the Stat Mod table.
// Sources: RULES_REFERENCE.md §2 (Table 1), CORE_REFERENCE.md §3.

export const STAT_KEYS = ["str", "int", "con", "dex", "cha"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  str: "Strength",
  int: "Intelligence",
  con: "Constitution",
  dex: "Dexterity",
  cha: "Charisma",
};

/** Five stat scores (the raw "score" values, not mods). */
export type StatScores = Record<StatKey, number>;

/** Both stat layers. Enhanced is used in normal play; Unenhanced is forced in some situations. */
export interface StatLayers {
  enhanced: StatScores;
  unenhanced: StatScores;
}

export function emptyScores(value = 1): StatScores {
  return { str: value, int: value, con: value, dex: value, cha: value };
}

/** Table 1: Stat Mods. Score → Mod. Scores below 1 have no mod. */
export function statMod(score: number): number {
  if (score < 1) return 0;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 9) return 3;
  if (score <= 19) return 4;
  if (score <= 49) return 5;
  if (score <= 99) return 6;
  if (score <= 149) return 7;
  if (score <= 199) return 8;
  if (score <= 299) return 9;
  return 10;
}

export function statMods(scores: StatScores): Record<StatKey, number> {
  return {
    str: statMod(scores.str),
    int: statMod(scores.int),
    con: statMod(scores.con),
    dex: statMod(scores.dex),
    cha: statMod(scores.cha),
  };
}

/** Character creation Standard Array (assign each once across the five stats). */
export const STANDARD_ARRAY = [2, 3, 4, 5, 6] as const;

/** All halving/quartering in the system rounds down. */
export function roundDown(n: number): number {
  return Math.floor(n);
}
