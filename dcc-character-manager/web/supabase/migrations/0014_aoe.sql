-- 0014: AoE markers on maps (T12 — bombs dropped onto the tactical map).
-- Markers live in maps.aoe jsonb: {id, x, y, radiusFt, label, note?, assetId?, by}.
-- Players can't UPDATE the GM's map row, so both mutations are SECURITY
-- DEFINER RPCs: any campaign member may add a marker (the thrower is stamped
-- server-side from auth.uid() — removal rights depend on it, so the client's
-- word is never trusted); the map owner (GM) may remove any marker, the
-- thrower only their own.

alter table public.maps add column if not exists aoe jsonb not null default '[]'::jsonb;

create or replace function public.add_aoe_marker(p_map uuid, p_marker jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
begin
  select m.campaign_id into v_campaign from maps m where m.id = p_map;
  if v_campaign is null or not (owns_campaign(v_campaign) or is_campaign_member(v_campaign)) then
    raise exception 'not allowed to mark this map';
  end if;
  if coalesce(p_marker->>'id', '') = '' then
    raise exception 'marker needs an id';
  end if;
  update maps
  set aoe = aoe || jsonb_set(p_marker, '{by}', to_jsonb(auth.uid()::text))
  where id = p_map;
end;
$$;

create or replace function public.remove_aoe_marker(p_map uuid, p_marker_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select m.owner_id into v_owner from maps m where m.id = p_map;
  if v_owner is null then
    raise exception 'no such map';
  end if;
  if v_owner = auth.uid() then
    update maps
    set aoe = coalesce(
      (select jsonb_agg(m) from jsonb_array_elements(aoe) m where m->>'id' <> p_marker_id),
      '[]'::jsonb)
    where id = p_map;
  else
    -- non-owners silently remove only markers they threw
    update maps
    set aoe = coalesce(
      (select jsonb_agg(m) from jsonb_array_elements(aoe) m
       where not (m->>'id' = p_marker_id and m->>'by' = auth.uid()::text)),
      '[]'::jsonb)
    where id = p_map;
  end if;
end;
$$;

revoke all on function public.add_aoe_marker(uuid, jsonb) from public, anon;
grant execute on function public.add_aoe_marker(uuid, jsonb) to authenticated;
revoke all on function public.remove_aoe_marker(uuid, text) from public, anon;
grant execute on function public.remove_aoe_marker(uuid, text) to authenticated;
