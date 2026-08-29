-- DCC Character Manager — initial schema.
-- Run this in the Supabase SQL editor (or `supabase db push` with the CLI).

-- ============================================================ characters
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  level int not null default 1 check (level between 1 and 250),
  floor int not null default 1 check (floor >= 1),
  race text,
  class text,
  -- {"enhanced": {"str":..,"int":..,"con":..,"dex":..,"cha":..}, "unenhanced": {...}}
  stats jsonb not null,
  -- current trackers (max values derive from stats in the app)
  current_hb_slots int not null default 10,
  current_mana int not null default 0,
  ai_favor int not null default 1,
  gold int not null default 0,
  misc_junk int not null default 0,
  move_ft int not null default 20,
  -- [{"name","category","stat","check_type","rank","marked","notes"}]
  skills jsonb not null default '[]'::jsonb,
  -- [{"name","mana","range","effect","rank","notes"}]
  spells jsonb not null default '[]'::jsonb,
  -- [{"name","note"}]
  debuffs jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ mob templates (reusable stat blocks)
create table public.mob_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  level int not null default 1,
  size int not null default 4,
  mob_type text,
  boss_tier text check (boss_tier in ('neighborhood','borough','city','province','country','floor')),
  is_elite boolean not null default false,
  -- stat scores {"str":..,"int":..,"con":..,"dex":..,"cha":..}
  stats jsonb not null,
  dr_adjust int not null default 0,
  move_ft int,
  -- [{"name","dice","die","bonus","damage_type","notes"}]
  attacks jsonb not null default '[]'::jsonb,
  abilities text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================ encounters
create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  floor int not null default 1,
  party_size int not null default 4,
  strength text not null default 'moderate'
    check (strength in ('weak','moderate','strong','overwhelming')),
  round int not null default 0,
  status text not null default 'planning' check (status in ('planning','running','done')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encounter_combatants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mob','boss','crawler')),
  name text not null,
  level int not null default 1,
  size int not null default 4,
  boss_tier text check (boss_tier in ('neighborhood','borough','city','province','country','floor')),
  is_elite boolean not null default false,
  character_id uuid references public.characters (id) on delete set null,
  -- stat scores snapshot for mobs/bosses
  stats jsonb,
  hb_slots int not null default 1,
  slot_value int not null default 1,
  current_slots int not null default 1,
  dr int not null default 0,
  move_ft int not null default 20,
  attacks jsonb not null default '[]'::jsonb,
  debuffs jsonb not null default '[]'::jsonb,
  abilities text,
  notes text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index encounter_combatants_encounter_idx on public.encounter_combatants (encounter_id, sort);
create index characters_owner_idx on public.characters (owner_id);
create index encounters_owner_idx on public.encounters (owner_id);
create index mob_templates_owner_idx on public.mob_templates (owner_id);

-- ============================================================ RLS: owners only
alter table public.characters enable row level security;
alter table public.mob_templates enable row level security;
alter table public.encounters enable row level security;
alter table public.encounter_combatants enable row level security;

create policy "characters owner all" on public.characters
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "mob_templates owner all" on public.mob_templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "encounters owner all" on public.encounters
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "encounter_combatants owner all" on public.encounter_combatants
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
