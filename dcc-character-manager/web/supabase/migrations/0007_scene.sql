-- Area feed: the shared map/monster image the GM displays on every party sheet.
-- Stored on the campaign so it survives reloads and late joiners; live updates
-- ride the existing Realtime broadcast channel.
alter table public.campaigns
  add column if not exists scene jsonb not null default '{}'::jsonb;
