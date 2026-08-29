-- 0011: tabletop tokens (T6).
-- Tokens live on a map, in map (image-pixel) coordinates, sized in grid
-- squares. GM (owner) has full control; campaign members see only tokens that
-- are not hidden (the GM-prep layer never reaches player clients — enforced
-- here, not client-side). Players move tokens through the move_token RPC,
-- which permits position-only writes on tokens linked to a character they own.

create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  asset_id uuid references public.assets(id) on delete set null,
  x double precision not null default 0,
  y double precision not null default 0,
  size_squares double precision not null default 1,
  hidden boolean not null default false,
  character_id uuid references public.characters(id) on delete set null,
  z integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tokens_map_idx on public.tokens (map_id);

alter table public.tokens enable row level security;

create policy "tokens owner all" on public.tokens
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Members read visible tokens on maps of campaigns they belong to. The maps
-- subquery runs under the member's own RLS, which already grants map reads.
create policy "tokens member read" on public.tokens
  for select using (
    hidden = false
    and exists (
      select 1 from public.maps m
      where m.id = map_id and public.is_campaign_member(m.campaign_id)
    )
  );

-- Position-only move: the GM for any of their tokens, a player only for a
-- token linked to a character they own. No UPDATE policy exists for members,
-- so this RPC is the sole write path for player drags.
create or replace function public.move_token(p_token uuid, p_x double precision, p_y double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update tokens t
  set x = p_x, y = p_y
  where t.id = p_token
    and (
      t.owner_id = auth.uid()
      or exists (
        select 1 from characters c
        where c.id = t.character_id and c.owner_id = auth.uid()
      )
    );
  if not found then
    raise exception 'not allowed to move this token';
  end if;
end;
$$;

revoke all on function public.move_token(uuid, double precision, double precision) from public, anon;
grant execute on function public.move_token(uuid, double precision, double precision) to authenticated;
