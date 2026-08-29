-- Link characters and encounters into campaigns; encounters can point at the area
-- (neighborhood/quest) they came from.
alter table public.characters
  add column if not exists campaign_id uuid references public.campaigns (id) on delete set null;

alter table public.encounters
  add column if not exists campaign_id uuid references public.campaigns (id) on delete set null,
  add column if not exists area_id uuid references public.campaign_areas (id) on delete set null;

create index if not exists characters_campaign_idx on public.characters (campaign_id);
create index if not exists encounters_campaign_idx on public.encounters (campaign_id);
