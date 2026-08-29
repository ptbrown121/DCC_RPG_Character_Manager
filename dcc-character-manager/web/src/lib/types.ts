import type { StatLayers, StatScores } from "./rules";

export interface SkillRow {
  name: string;
  category: "attack" | "spell" | "utility";
  stat: "str" | "int" | "con" | "dex" | "cha" | null;
  check_type: "opposed" | "unopposed" | "passive" | "evade";
  rank: number;
  marked: boolean;
  /** Grind hours accrued toward this skill's next advancement check. */
  grind?: number;
  notes?: string;
}

export interface GrindState {
  total: number;
  today: number;
}

export interface SponsorEntry {
  name: string;
  floor: number;
  notes: string;
}

export interface SocialState {
  popularity?: number;
  top_ten?: number | null;
  bounty?: string;
  sponsors?: SponsorEntry[];
  deity?: { name: string; tier: "acolyte" | "devotee" | "zealot"; streak: number; lapse: string };
}

export interface SpellRow {
  name: string;
  mana: number;
  range?: string;
  effect?: string;
  rank: number;
  /** Pinned to one of the 10 HUD Hotlist slots (spells must be hotlisted to cast in combat). */
  hotlist?: boolean;
  notes?: string;
}

export interface DebuffRow {
  name: string;
  note?: string;
}

export interface AttackRow {
  name: string;
  dice: number;
  die: number;
  bonus: number;
  damage_type?: string;
  notes?: string;
}

export interface AppliedTrait {
  name: string;
  abilities: string[];
  drawbacks: string[];
  custom?: boolean;
}

export interface Traits {
  race?: AppliedTrait;
  class?: AppliedTrait;
}

export interface LootBoxEntry {
  tier: string;
  type: string;
  source: string;
  opened: boolean;
  contents: string;
  at: string;
}

export interface CompanionEntry {
  kind: "pet" | "mount" | "minion";
  name: string;
  species: string;
  level: number;
  attitude?: "hostile" | "calm" | "friendly" | "bonded";
  role?: "tank" | "aggressive" | "utility";
  hb_slots: number;
  current_slots: number;
  notes: string;
}

export interface VehicleEntry {
  name: string;
  move: number;
  size: number;
  dr: number;
  occupancy: string;
  current_slots: number;
  upgrades: string;
}

export interface Character {
  id: string;
  owner_id: string;
  name: string;
  level: number;
  floor: number;
  race: string | null;
  class: string | null;
  stats: StatLayers;
  current_hb_slots: number;
  current_mana: number;
  ai_favor: number;
  gold: number;
  misc_junk: number;
  move_ft: number;
  skills: SkillRow[];
  spells: SpellRow[];
  debuffs: DebuffRow[];
  traits: Traits;
  campaign_id: string | null;
  grind: GrindState;
  social: SocialState;
  loot: LootBoxEntry[];
  companions: CompanionEntry[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AchievementEntry {
  name: string;
  reward: string;
  troll: boolean;
  earned_by: string;
  at: string;
}

/** Shared map/monster image the GM displays on every party sheet ("Area feed"). */
export interface SceneState {
  imageUrl?: string;
  caption?: string;
}

export interface Campaign {
  id: string;
  owner_id: string;
  name: string;
  achievements: AchievementEntry[];
  vehicles: VehicleEntry[];
  /** Optional until migration 0007 has been run. */
  scene?: SceneState | null;
  /** Shareable invite code. Optional until migration 0008 has been run. */
  join_code?: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A player account that joined a campaign via join code (migration 0008). */
export interface CampaignMember {
  campaign_id: string;
  user_id: string;
  /** Email captured at join time; null for pre-capture rows. */
  display: string | null;
  created_at: string;
}

export interface CampaignFloor {
  id: string;
  campaign_id: string;
  owner_id: string;
  floor_number: number;
  collapse_days: number;
  hours_elapsed: number;
  janitor: string | null;
  status: "upcoming" | "active" | "cleared" | "collapsed";
  notes: string | null;
}

export interface BossEntry {
  name: string;
  level: number;
  tier: string;
  clues: string;
  phases: string;
  defeated: boolean;
}

export interface NpcEntry {
  name: string;
  title: string;
  level: number | null;
  kind: "statblock" | "ai-card" | "noncombatant";
  notes: string;
}

export interface CampaignArea {
  id: string;
  campaign_id: string;
  floor_id: string;
  owner_id: string;
  kind: "neighborhood" | "quest";
  name: string;
  status: "unexplored" | "active" | "cleared";
  sections: Record<string, string>;
  bosses: BossEntry[];
  npcs: NpcEntry[];
  sort: number;
  created_at: string;
}

export interface Encounter {
  id: string;
  owner_id: string;
  name: string;
  floor: number;
  party_size: number;
  strength: "weak" | "moderate" | "strong" | "overwhelming";
  round: number;
  status: "planning" | "running" | "done";
  campaign_id: string | null;
  area_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Combatant {
  id: string;
  encounter_id: string;
  owner_id: string;
  kind: "mob" | "boss" | "crawler";
  name: string;
  level: number;
  size: number;
  boss_tier: "neighborhood" | "borough" | "city" | "province" | "country" | "floor" | null;
  is_elite: boolean;
  character_id: string | null;
  stats: StatScores | null;
  hb_slots: number;
  slot_value: number;
  current_slots: number;
  dr: number;
  move_ft: number;
  attacks: AttackRow[];
  debuffs: DebuffRow[];
  abilities: string | null;
  notes: string | null;
  sort: number;
  created_at: string;
}
