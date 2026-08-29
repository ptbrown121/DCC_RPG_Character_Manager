-- Campaign tracker: campaigns → floors (collapse clocks) → areas (neighborhoods/quests).

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- [{"name","reward","troll","earned_by","at"}]
  achievements jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_floors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  floor_number int not null,
  -- Collapse timer: total days (30-hour dungeon days) and hours already burned.
  collapse_days int not null default 5,
  hours_elapsed int not null default 0,
  janitor text,
  status text not null default 'upcoming' check (status in ('upcoming','active','cleared','collapsed')),
  notes text,
  unique (campaign_id, floor_number)
);

create table public.campaign_areas (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  floor_id uuid not null references public.campaign_floors (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'neighborhood' check (kind in ('neighborhood','quest')),
  name text not null,
  status text not null default 'unexplored' check (status in ('unexplored','active','cleared')),
  -- 13-part template's text sections (all optional): {"summary":"", "strong_starts":"", ...}
  sections jsonb not null default '{}'::jsonb,
  -- [{"name","level","tier","clues","phases","defeated"}]
  bosses jsonb not null default '[]'::jsonb,
  -- [{"name","title","level","kind","notes"}]  kind: statblock | ai-card | noncombatant
  npcs jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index campaign_floors_campaign_idx on public.campaign_floors (campaign_id, floor_number);
create index campaign_areas_floor_idx on public.campaign_areas (floor_id, sort);

alter table public.campaigns enable row level security;
alter table public.campaign_floors enable row level security;
alter table public.campaign_areas enable row level security;

create policy "campaigns owner all" on public.campaigns
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "campaign_floors owner all" on public.campaign_floors
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "campaign_areas owner all" on public.campaign_areas
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
