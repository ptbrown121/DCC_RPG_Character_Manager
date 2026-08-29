-- Campaign membership: players join the GM's campaign with a short code; members
-- get READ access to campaign content (campaign row incl. scene/Area feed, floors,
-- areas) and the party's characters; the GM gets READ access to members' linked
-- characters. All writes stay owner-only. Fixes the cross-account gaps where the
-- Area-feed late-join read and the party roster only worked same-account.

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Captured from auth.users.email at join time so the GM's member list is human-readable.
  display text,
  created_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

alter table public.campaign_members enable row level security;

-- Short shareable invite code. Volatile default → each existing row gets its own.
-- Members can read it off the campaign row; that's fine — they're already in.
alter table public.campaigns
  add column if not exists join_code text not null unique
  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- SECURITY DEFINER helpers so policies can cross-reference campaigns ⇄ members
-- without RLS recursion (a members policy that read campaigns through RLS, while
-- campaigns has a policy reading members, would loop).
create or replace function public.is_campaign_member(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from campaign_members m
    where m.campaign_id = cid and m.user_id = auth.uid()
  );
$$;

create or replace function public.owns_campaign(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from campaigns c
    where c.id = cid and c.owner_id = auth.uid()
  );
$$;

-- Membership rows: you see your own; the GM sees (and can remove) their campaign's.
-- Inserts happen only through the join_campaign() RPC below — no insert policy.
create policy "campaign_members self or gm read" on public.campaign_members
  for select using (user_id = auth.uid() or public.owns_campaign(campaign_id));
create policy "campaign_members leave or kick" on public.campaign_members
  for delete using (user_id = auth.uid() or public.owns_campaign(campaign_id));

-- Member read on campaign content (owner already has ALL from earlier migrations).
create policy "campaigns member read" on public.campaigns
  for select using (public.is_campaign_member(id));
create policy "campaign_floors member read" on public.campaign_floors
  for select using (public.is_campaign_member(campaign_id));
create policy "campaign_areas member read" on public.campaign_areas
  for select using (public.is_campaign_member(campaign_id));

-- Party visibility: the GM and fellow members can read characters linked to the
-- campaign (roster, HB status, GM prep). Read-only — writes remain owner-only.
create policy "characters party read" on public.characters
  for select using (
    campaign_id is not null
    and (public.owns_campaign(campaign_id) or public.is_campaign_member(campaign_id))
  );

-- Join by code. SECURITY DEFINER because the joiner can't read the campaign row
-- yet (that's the point); validates the code, records membership idempotently.
create or replace function public.join_campaign(code text)
returns table (campaign_id uuid, campaign_name text)
language plpgsql security definer set search_path = public
as $$
-- The campaign_id OUT param would otherwise shadow the column in ON CONFLICT.
#variable_conflict use_column
declare
  target record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id, name into target from campaigns
    where join_code = upper(trim(code));
  if not found then
    raise exception 'No campaign with that join code';
  end if;
  insert into campaign_members (campaign_id, user_id, display)
  values (target.id, auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (campaign_id, user_id) do nothing;
  return query select target.id, target.name;
end;
$$;

revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;

-- GM removes a member AND unlinks their characters (the GM can't update player-
-- owned character rows directly, so the unlink needs definer rights).
create or replace function public.kick_member(cid uuid, member uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from campaigns where id = cid and owner_id = auth.uid()) then
    raise exception 'Only the GM can remove members';
  end if;
  delete from campaign_members where campaign_id = cid and user_id = member;
  update characters set campaign_id = null
    where campaign_id = cid and owner_id = member;
end;
$$;

revoke all on function public.kick_member(uuid, uuid) from public, anon;
grant execute on function public.kick_member(uuid, uuid) to authenticated;
