-- 0012: item catalog (T8).
-- GM-authored items for a campaign: icon (assets row), kind, rarity, and an
-- `effect` jsonb executed only by the rules engine (applyItemEffect — plan D7
-- union: heal_slots / restore_mana / cure_debuff / aoe / custom). Owner (GM)
-- has full control; campaign members read (inventory + tooltips arrive with
-- 0013 / T9, which references these rows).

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  description text not null default '',
  asset_id uuid references public.assets(id) on delete set null,
  kind text not null default 'consumable'
    check (kind in ('consumable', 'bomb', 'equipment', 'quest', 'junk')),
  rarity text not null default 'common'
    check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'celestial')),
  stackable boolean not null default true,
  effect jsonb,
  created_at timestamptz not null default now()
);

create index if not exists items_campaign_idx on public.items (campaign_id);

alter table public.items enable row level security;

-- with check also demands campaign ownership: without it any member could
-- insert their own rows into the GM's catalog (they'd be visible party-wide).
create policy "items owner all" on public.items
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and public.owns_campaign(campaign_id));

create policy "items member read" on public.items
  for select using (public.is_campaign_member(campaign_id));
