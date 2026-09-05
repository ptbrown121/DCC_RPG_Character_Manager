\set ON_ERROR_STOP on
set client_min_messages = warning;

begin;

-- ── seed (as superuser, bypassing RLS) ───────────────────────────────────────
insert into auth.users (id,email) values
  ('11111111-1111-4111-8111-111111111111','gm@t'), ('22222222-2222-4222-8222-222222222222','player@t'), ('33333333-3333-4333-8333-333333333333','stranger@t');

set local test.uid = '11111111-1111-4111-8111-111111111111';
insert into public.campaigns (id, owner_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','GM Camp');
insert into public.campaign_floors (id, campaign_id, owner_id, floor_number)
  values (gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',1);
insert into public.assets (id, owner_id, campaign_id, kind, name, storage_path, width, height)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','map','m','11111111-1111-4111-8111-111111111111/x.webp',10,10);
insert into public.maps (id, campaign_id, owner_id, name, asset_id)
  values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Map','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into public.items (id, campaign_id, owner_id, name, kind)
  values ('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Potion','consumable');

set local test.uid = '22222222-2222-4222-8222-222222222222';
insert into public.characters (id, owner_id, name, stats, campaign_id)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','Player PC','{}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

set local test.uid = '33333333-3333-4333-8333-333333333333';
insert into public.campaigns (id, owner_id, name) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','Stranger Camp');

-- player joins the GM campaign as a member (via the definer RPC)
set local test.uid = '22222222-2222-4222-8222-222222222222';
select public.join_campaign((select join_code from public.campaigns where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));

reset test.uid;

-- ── assertion helper ─────────────────────────────────────────────────────────
create or replace function pg_temp.expect(cond boolean, label text) returns void
  language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', label;
  end if;
  raise warning 'ok: %', label;
end $$;

-- realtime_topic_access(topic, want_publish) evaluated as each user.
create or replace function pg_temp.access(uid uuid, topic text, publish boolean) returns boolean
  language plpgsql as $$
declare r boolean;
begin
  perform set_config('test.uid', uid::text, true);
  execute 'select public.realtime_topic_access($1,$2)' into r using topic, publish;
  return r;
end $$;

do $$
declare
  gm uuid := '11111111-1111-4111-8111-111111111111'; pl uuid := '22222222-2222-4222-8222-222222222222'; st uuid := '33333333-3333-4333-8333-333333333333';
  camp text := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; char text := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; mp text := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  hud_c text := 'hud:campaign:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  hud_p text := 'hud:character:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  t_map text := 'map:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  t_moves text := 'moves:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  t_aoe text := 'aoe:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  t_ping text := 'ping:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  t_draw text := 'draw:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  t_meta text := 'mapmeta:dddddddd-dddd-4ddd-8ddd-dddddddddddd';
begin
  -- campaign HUD: GM talks + listens; member listens only; stranger nothing.
  perform pg_temp.expect(pg_temp.access(gm, hud_c, true),  'campaignHud: GM may publish');
  perform pg_temp.expect(pg_temp.access(gm, hud_c, false), 'campaignHud: GM may receive');
  perform pg_temp.expect(not pg_temp.access(pl, hud_c, true),  'campaignHud: member may NOT publish');
  perform pg_temp.expect(pg_temp.access(pl, hud_c, false),     'campaignHud: member may receive');
  perform pg_temp.expect(not pg_temp.access(st, hud_c, false), 'campaignHud: stranger may NOT receive');
  perform pg_temp.expect(not pg_temp.access(st, hud_c, true),  'campaignHud: stranger may NOT publish');

  -- private HUD: crawler owner listens; that campaign's GM talks; nobody else.
  perform pg_temp.expect(pg_temp.access(pl, hud_p, false),     'characterHud: owner may receive');
  perform pg_temp.expect(not pg_temp.access(pl, hud_p, true),  'characterHud: owner may NOT publish');
  perform pg_temp.expect(pg_temp.access(gm, hud_p, true),      'characterHud: GM may publish');
  perform pg_temp.expect(not pg_temp.access(st, hud_p, false), 'characterHud: stranger may NOT receive');

  -- GM-only map lifecycle topics.
  perform pg_temp.expect(pg_temp.access(gm, t_map, true),      'map: GM may publish');
  perform pg_temp.expect(not pg_temp.access(pl, t_map, true),  'map: member may NOT publish');
  perform pg_temp.expect(pg_temp.access(pl, t_map, false),     'map: member may receive');
  perform pg_temp.expect(not pg_temp.access(pl, t_draw, true), 'draw: member may NOT publish');
  perform pg_temp.expect(not pg_temp.access(pl, t_meta, true), 'mapmeta: member may NOT publish');

  -- everyone-may-publish table topics.
  perform pg_temp.expect(pg_temp.access(pl, t_moves, true),    'moves: member may publish');
  perform pg_temp.expect(pg_temp.access(pl, t_aoe, true),      'aoe: member may publish');
  perform pg_temp.expect(pg_temp.access(pl, t_ping, true),     'ping: member may publish');
  perform pg_temp.expect(not pg_temp.access(st, t_moves, true),'moves: stranger may NOT publish');
  perform pg_temp.expect(not pg_temp.access(st, t_aoe, false), 'aoe: stranger may NOT receive');

  -- malformed / unknown topics are denied, not errored.
  perform pg_temp.expect(not pg_temp.access(gm, 'hud:campaign:not-a-uuid', false), 'garbage uuid denied');
  perform pg_temp.expect(not pg_temp.access(gm, 'bogus:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false),            'unknown prefix denied');
  perform pg_temp.expect(not pg_temp.access(gm, 'hud:campaign:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:extra', false),'extra segment denied');
  perform pg_temp.expect(not pg_temp.access(gm, 'map:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true),               'map topic w/ campaign id denied');
  -- signed-out (no uid) denied.
  perform set_config('test.uid','',true);
  perform pg_temp.expect(not (select public.realtime_topic_access('hud:campaign:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false)), 'signed-out denied');

  raise warning '--- realtime matrix passed ---';
end $$;

-- ── 0015 write hardening + RPC spot-checks, as the app role under RLS ─────────
set role app;

-- member cannot insert a map/asset/token into the GM's campaign (owner_id spoof)
set local test.uid = '22222222-2222-4222-8222-222222222222';
do $$ begin
  begin
    insert into public.maps (campaign_id, owner_id, name, asset_id)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','sneaky', null);
    raise exception 'FAIL: member inserted a map into the GM campaign';
  exception when insufficient_privilege or check_violation then
    raise warning 'ok: member map insert blocked (RLS)';
  end;
  begin
    insert into public.assets (owner_id, campaign_id, kind, name, storage_path, width, height)
      values ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','map','x','22222222-2222-4222-8222-222222222222/y.webp',1,1);
    raise exception 'FAIL: member inserted an asset into the GM campaign';
  exception when insufficient_privilege or check_violation then
    raise warning 'ok: member asset insert blocked (RLS)';
  end;
end $$;

-- move_token: a stranger cannot move a token they don't own (RPC raises)
reset role; set role app; set local test.uid = '11111111-1111-4111-8111-111111111111';
insert into public.tokens (id, map_id, owner_id, name) values
  ('99999999-9999-4999-8999-999999999999','dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','goblin');
set local test.uid = '33333333-3333-4333-8333-333333333333';
do $$ begin
  begin
    perform public.move_token('99999999-9999-4999-8999-999999999999', 5, 5);
    raise exception 'FAIL: stranger moved a GM token';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise warning 'ok: stranger move_token rejected (%)', sqlerrm;
  end;
end $$;

-- grant_item: a stranger cannot grant into a campaign they don't own
set local test.uid = '33333333-3333-4333-8333-333333333333';
do $$ begin
  begin
    perform public.grant_item('cccccccc-cccc-4ccc-8ccc-cccccccccccc','ffffffff-ffff-4fff-8fff-ffffffffffff',1);
    raise exception 'FAIL: stranger granted an item';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise warning 'ok: stranger grant_item rejected (%)', sqlerrm;
  end;
end $$;
reset role;

-- ── policies actually reference the function (guard against a future edit
--    dropping the wrapper but leaving the function) ─────────────────────────
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname='realtime' and tablename='messages'
     and policyname in ('dcc topics receive','dcc topics publish');
  perform pg_temp.expect(n = 2, 'both realtime.messages policies present');
end $$;

commit;

select '================  ALL HARNESS ASSERTIONS PASSED  ================' as result;
