// Loot boxes, vehicles, and companions (pets/mounts/minions).
// Sources: core rulebook pp. 21–23 (loot boxes), 72–74 (vehicles), 228–233 (pets/mounts/minions).

import type { BossTier } from "./adversary";

// ---------------------------------------------------------------- loot boxes

export const LOOT_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Legendary", "Celestial"] as const;
export type LootTier = (typeof LOOT_TIERS)[number];

/** Box types awarded by the System AI (plus Fan/Benefactor from the popularity systems). */
export const LOOT_BOX_TYPES = [
  "Adventurer",
  "Assassin's",
  "Asshole's",
  "Benefactor",
  "Boss",
  "Crafter's",
  "Fan",
  "Goblin",
  "Looter",
  "Lucky Bastard",
  "Lucky Bitch",
  "Mechanic's",
  "Pet",
  "Quest",
  "Savage",
  "Survivor's",
] as const;

/** Boss tier → Boss Box tier (p. 22). */
export const BOSS_BOX: Record<BossTier, LootTier> = {
  neighborhood: "Bronze",
  borough: "Silver",
  city: "Gold",
  province: "Platinum",
  country: "Legendary",
  floor: "Celestial",
};

// ---------------------------------------------------------------- vehicles

/** Vehicles have 10 HB slots; each slot's value = the vehicle's size (1–8). */
export const VEHICLE_HB_SLOTS = 10;

/** At 0% the vehicle explodes: (size)d6 + F Fire to occupants, ignoring the vehicle's DR. */
export function vehicleExplosion(size: number, floor: number): string {
  return `${size}d6+${floor} Fire`;
}

/** Ramming damage: 1d6 per size value + 1d6 per (Move ÷ 10). Rammer takes half and halves Move. */
export function ramDice(size: number, moveFt: number): number {
  return size + Math.floor(moveFt / 10);
}

export interface SampleVehicle {
  name: string;
  move: number;
  size: number;
  dr: number;
  occupancy: string;
}

/** Table 7: sample vehicles. */
export const SAMPLE_VEHICLES: SampleVehicle[] = [
  { name: "Skateboard", move: 30, size: 2, dr: 0, occupancy: "1" },
  { name: "Bicycle", move: 40, size: 3, dr: 0, occupancy: "1–2" },
  { name: "Tank", move: 50, size: 6, dr: 10, occupancy: "4" },
  { name: "18-Wheeler", move: 60, size: 7, dr: 4, occupancy: "4 (+50 cargo)" },
  { name: "Large Truck", move: 70, size: 6, dr: 4, occupancy: "3 (+5 cargo)" },
  { name: "Mid-Sized Sedan", move: 80, size: 5, dr: 3, occupancy: "5–6" },
  { name: "Sportscar", move: 100, size: 5, dr: 2, occupancy: "2" },
  { name: "Motorcycle", move: 120, size: 4, dr: 1, occupancy: "1–2" },
];

// ---------------------------------------------------------------- pets / mounts / minions

export const PET_PRICE_GOLD = 10_000;
export const MOUNT_PRICE_GOLD = 20_000;
export const MOUNT_UPGRADE_GOLD = 5_000;

/** Taming ladder: attitude → what it takes to climb one rung (INT-Opposed Animal Handling, 20 min each). */
export const PET_ATTITUDES = [
  { value: "hostile", label: "Hostile", climb: "Amazing Success+ to reach Calm" },
  { value: "calm", label: "Calm", climb: "Standard Success+ to reach Friendly" },
  { value: "friendly", label: "Friendly", climb: "Amazing Success+ to reach Bonded" },
  { value: "bonded", label: "Bonded", climb: "Bond complete — one per crawler" },
] as const;
export type PetAttitude = (typeof PET_ATTITUDES)[number]["value"];

/** Taming check difficulty: 10 + the creature's INT Mod + Floor. */
export function tamingDifficulty(intMod: number, floor: number): number {
  return 10 + intMod + floor;
}

export const PET_ROLES = [
  { value: "tank", label: "Tank", perk: "DR = Floor + 1 Special Ability" },
  { value: "aggressive", label: "Aggressive", perk: "Back Claw & Bite (Rank = Floor), +Floor damage, no Special Abilities" },
  { value: "utility", label: "Utility", perk: "2 Special Abilities" },
] as const;
export type PetRole = (typeof PET_ROLES)[number]["value"];

/** Pets level with the party, 2 levels at a time until 15 (mature), then 1:1. */
export const PET_MATURE_LEVEL = 15;
export function petLevelStep(currentLevel: number): number {
  return currentLevel < PET_MATURE_LEVEL ? 2 : 1;
}

/** Pet stat gains: 3 points per level, never into INT. Skill/attack Ranks always = Floor. */
export const PET_STAT_POINTS_PER_LEVEL = 3;

/** Mount HB slots = its size; mounts never level. Must be ≥1 size class larger than the rider. */
export function mountHbSlots(size: number): number {
  return Math.max(1, size);
}

/** Minions obey commands; they become Bereft if their owner dies. */
export const MINION_NOTE = "Commanded like pets; Bereft on owner death";
