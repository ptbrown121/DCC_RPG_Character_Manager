// Merged race/class catalogs (agent-converted from extraction notes).
import { RACES } from "./races";
import { CLASSES_1 } from "./classes1";
import { CLASSES_2 } from "./classes2";
import type { CatalogRace, CatalogClass } from "./raceclass";

export const ALL_RACES: CatalogRace[] = RACES;
export const ALL_CLASSES: CatalogClass[] = [...CLASSES_1, ...CLASSES_2];

export function catalogRace(name: string): CatalogRace | undefined {
  return ALL_RACES.find((r) => r.name === name);
}

export function catalogClass(name: string): CatalogClass | undefined {
  return ALL_CLASSES.find((c) => c.name === name);
}
