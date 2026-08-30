-- 0013: character inventory + hotbar column (T9, shared with T10).
-- character_items links crawlers to catalog items with a quantity. The player
-- (character owner) has full control of their own rows; the GM of the
-- character's campaign can read them and grants through the grant_item RPC —
-- the sole GM write path, so there is no GM UPDATE/DELETE surface on player
-- inventories. One row per (character, item); granting more bumps qty.

create table if not exists public.character_items (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  qty integer not null default 1 check (qty > 0),
  acquired_at timestamptz not null default now(),
  unique (character_id, item_id)
);

create index if not exists character_items_character_idx on public.character_items (character_id);

alter table public.character_items enable row level security;

create policy "character_items owner all" on public.character_items
  for all using (
    exists (select 1 from public.characters c where c.id = character_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.characters c where c.id = character_id and c.owner_id = auth.uid())
  );

create policy "character_items gm read" on public.character_items
  for select using (
    exists (
      select 1 from public.characters c
      where c.id = character_id
        and c.campaign_id is not null
        and public.owns_campaign(c.campaign_id)
    )
  );

-- GM grant: upsert qty for a crawler in a campaign the caller owns. The item
-- must belong to that same campaign, so a GM can't seed someone else's table.
create or replace function public.grant_item(p_character uuid, p_item uuid, p_qty integer default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'qty must be at least 1';
  end if;
  select c.campaign_id into v_campaign
  from characters c
  where c.id = p_character;
  if v_campaign is null or not owns_campaign(v_campaign) then
    raise exception 'not allowed to grant to this character';
  end if;
  if not exists (select 1 from items i where i.id = p_item and i.campaign_id = v_campaign) then
    raise exception 'item is not in this campaign';
  end if;
  insert into character_items (character_id, item_id, qty)
  values (p_character, p_item, p_qty)
  on conflict (character_id, item_id)
  do update set qty = character_items.qty + excluded.qty;
end;
$$;

revoke all on function public.grant_item(uuid, uuid, integer) from public, anon;
grant execute on function public.grant_item(uuid, uuid, integer) to authenticated;

-- T10's unified hotbar (spells + items in explicit slots) ships its column
-- here so 0013 stays the one inventory migration:
-- [{type:'spell'|'item', id} | null, ...] — 10 entries once seeded.
alter table public.characters add column if not exists hotbar jsonb not null default '[]'::jsonb;
