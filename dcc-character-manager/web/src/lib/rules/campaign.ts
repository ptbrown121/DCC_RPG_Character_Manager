// Campaign structure constants.
// Source: GM_REFERENCE.md §3 (core rulebook pp. 258–265 + floor chapters).

import { DUNGEON_DAY_HOURS } from "./derived";
import { FLOOR_TIMERS } from "./adversary";

/** Default janitor mobs by floor (F1/F2 unlisted; F5 varies by quadrant). */
export const DEFAULT_JANITORS: Record<number, string> = {
  3: "Street Urchins",
  4: "Jikininki Ghoul",
  5: "Varies by quadrant",
};

/** Collapse timer defaults in 30-hour days (Floors 1–5). */
export function defaultCollapseDays(floor: number): number {
  return FLOOR_TIMERS[floor] ?? 10;
}

export function floorTotalHours(collapseDays: number): number {
  return collapseDays * DUNGEON_DAY_HOURS;
}

export function hoursRemaining(collapseDays: number, hoursElapsed: number): number {
  return Math.max(0, floorTotalHours(collapseDays) - hoursElapsed);
}

/** Format remaining time as "Xd Yh" in 30-hour dungeon days. */
export function formatDungeonTime(hours: number): string {
  const d = Math.floor(hours / DUNGEON_DAY_HOURS);
  const h = hours % DUNGEON_DAY_HOURS;
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

/**
 * The neighborhood write-up template (13 parts; sections optional in practice).
 * Bosses and NPCs are tracked as structured lists; the rest are text sections.
 */
export const AREA_SECTIONS: { key: string; label: string; questLabel?: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "strong_starts", label: "Strong Starts" },
  { key: "story_arcs", label: "Story Arcs" },
  { key: "mobs", label: "Mobs" },
  { key: "environment", label: "Environment" },
  { key: "traps", label: "Traps" },
  { key: "items", label: "Items" },
  { key: "achievements_rewards", label: "Achievements & Rewards" },
  { key: "grinding", label: "Grinding table" },
  { key: "quarters", label: "Quarters", questLabel: "Quest Stages" },
  { key: "boss_battle", label: "Boss Battle notes" },
];

/** Player-facing arc of a neighborhood. */
export const AREA_PHASES = ["Opening Discovery", "Mastering the Area", "Things Blow Up"] as const;

/** Recommended floor planning: 4–6 active neighborhoods, 6–12 sessions per floor. */
export const FLOOR_PLANNING = { minNeighborhoods: 4, maxNeighborhoods: 6, minSessions: 6, maxSessions: 12 } as const;

export const NPC_KINDS = [
  { value: "statblock", label: "Full stat block" },
  { value: "ai-card", label: "AI card (name/title/level)" },
  { value: "noncombatant", label: "Non-combatant" },
] as const;
