-- Tabletop maps: a background image from the asset library plus grid settings.
-- The campaign points at one "active" map that player sheets display (T5).
-- drawings holds the GM's freehand strokes (T7); stored here so a map carries
-- its annotations with it.

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  asset_id uuid references public.assets (id) on delete set null,
  -- {ftPerSquare, pxPerSquare, offsetX, offsetY, show} — feet are the game unit;
  -- pxPerSquare calibrates the grid against the background image's pixels.
  grid jsonb not null default '{"ftPerSquare":5,"pxPerSquare":100,"offsetX":0,"offsetY":0,"show":true}'::jsonb,
  -- [{id, color, width, points: [[x,y],...]}] in map (image-pixel) coordinates
  drawings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index maps_campaign_idx on public.maps (campaign_id);

alter table public.maps enable row level security;

create policy "maps owner all" on public.maps
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "maps member read" on public.maps
  for select using (public.is_campaign_member(campaign_id));

alter table public.campaigns
  add column if not exists active_map_id uuid references public.maps (id) on delete set null;
