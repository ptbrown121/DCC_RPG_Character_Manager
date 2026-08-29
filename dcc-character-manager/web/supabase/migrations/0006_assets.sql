-- Loot box log + companions (pets/mounts/minions) on characters; vehicles on campaigns.
-- loot:       [{"tier","type","source","opened","contents","at"}]
-- companions: [{"kind","name","species","level","attitude","role","hb_slots","current_slots","notes"}]
-- vehicles:   [{"name","move","size","dr","occupancy","current_slots","upgrades"}]
alter table public.characters
  add column if not exists loot jsonb not null default '[]'::jsonb,
  add column if not exists companions jsonb not null default '[]'::jsonb;

alter table public.campaigns
  add column if not exists vehicles jsonb not null default '[]'::jsonb;
