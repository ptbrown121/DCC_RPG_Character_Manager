-- 0016: Realtime authorization — broadcast channels become PRIVATE.
--
-- Until now every channel was a public broadcast topic: anyone who learned a
-- campaign/map UUID could subscribe, and any member could publish GM-looking
-- events (system_send, hud_config that blanks a player's HUD, map_state,
-- token/draw lifecycle). Postgres was always authoritative so nothing could
-- be corrupted, but the table could be trolled. From here on the client opens
-- every channel with `config: { private: true }` (src/lib/realtime.ts) and
-- Realtime evaluates these policies on realtime.messages at join time:
--   SELECT policy  → may the caller RECEIVE on this topic?
--   INSERT policy  → may the caller PUBLISH on this topic?
-- Policies are per-topic, not per-event, so GM-only and everyone-may-publish
-- traffic ride separate topics.
--
-- Topic grammar (must match src/lib/realtime.ts `topics`):
--   hud:campaign:<campaign_id>   receive: GM + members   publish: GM
--   hud:character:<character_id> receive: its owner + GM publish: GM
--   map:<map_id>                 receive: GM + members   publish: GM   (token lifecycle)
--   draw:<map_id>                receive: GM + members   publish: GM   (GM drawing layer)
--   mapmeta:<map_id>             receive: GM + members   publish: GM   (grid/name patches)
--   moves:<map_id>               receive: GM + members   publish: GM + members (token_move)
--   ping:<map_id>                receive: GM + members   publish: GM + members
--   aoe:<map_id>                 receive: GM + members   publish: GM + members
-- Anything else — unknown prefix, malformed uuid, extra segments, unknown
-- row, signed-out caller — is denied without raising.

create or replace function public.realtime_topic_access(topic text, want_publish boolean)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  p1 text := split_part(topic, ':', 1);
  p2 text := split_part(topic, ':', 2);
  p3 text := split_part(topic, ':', 3);
  p4 text := split_part(topic, ':', 4);
  scope text;      -- 'campaign' | 'character' | 'map'
  ref uuid;
  gm_only boolean; -- publish restricted to the campaign owner
  cid uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  begin
    if p1 = 'hud' and p2 in ('campaign', 'character') and p3 <> '' and p4 = '' then
      scope := p2;
      ref := p3::uuid;
      gm_only := true;
    elsif p1 in ('map', 'draw', 'mapmeta') and p2 <> '' and p3 = '' then
      scope := 'map';
      ref := p2::uuid;
      gm_only := true;
    elsif p1 in ('moves', 'ping', 'aoe') and p2 <> '' and p3 = '' then
      scope := 'map';
      ref := p2::uuid;
      gm_only := false;
    else
      return false;
    end if;
  exception when invalid_text_representation then
    return false;
  end;

  if scope = 'character' then
    -- Private HUD: the crawler's owner listens; the GM of their campaign talks.
    if not want_publish
       and exists (select 1 from characters c where c.id = ref and c.owner_id = auth.uid()) then
      return true;
    end if;
    select c.campaign_id into cid from characters c where c.id = ref;
    return cid is not null and owns_campaign(cid);
  end if;

  if scope = 'campaign' then
    cid := ref;
  else
    select m.campaign_id into cid from maps m where m.id = ref;
  end if;
  if cid is null then
    return false;
  end if;

  if owns_campaign(cid) then
    return true;
  end if;
  if want_publish and gm_only then
    return false;
  end if;
  return is_campaign_member(cid);
end;
$$;

revoke all on function public.realtime_topic_access(text, boolean) from public, anon;
grant execute on function public.realtime_topic_access(text, boolean) to authenticated;

-- realtime.messages already has RLS enabled on every Supabase project; with
-- no policies, private channels deny everyone — which is what protects the
-- topics until this migration runs (public channels are unaffected by RLS).
drop policy if exists "dcc topics receive" on realtime.messages;
create policy "dcc topics receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.realtime_topic_access(realtime.topic(), false)
  );

drop policy if exists "dcc topics publish" on realtime.messages;
create policy "dcc topics publish" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.realtime_topic_access(realtime.topic(), true)
  );
