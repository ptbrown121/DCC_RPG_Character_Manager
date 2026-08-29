import type { StatLayers, StatScores } from "./rules";

export interface SkillRow {
  name: string;
  category: "attack" | "spell" | "utility";
  stat: "str" | "int" | "con" | "dex" | "cha" | null;
  check_type: "opposed" | "unopposed" | "passive" | "evade";
  rank: number;
  marked: boolean;
  notes?: string;
}

export interface SpellRow {
  name: string;
  mana: number;
  range?: string;
  effect?: string;
  rank: number;
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

export interface Campaign {
  id: string;
  owner_id: string;
  name: string;
  achievements: AchievementEntry[];
  notes: string | null;
  created_at: string;
  updated_at: string;
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
