-- Harness prelude: the slice of the Supabase-managed schema our migrations lean
-- on, stubbed just enough to load them into a bare Postgres and exercise RLS.
-- NOTHING here ships to Supabase — the real platform owns auth/storage/realtime.
--
-- The identity switch is a GUC: auth.uid() reads test.uid, so the suite plays
-- different users with `set local test.uid = '<uuid>'`. RLS is enforced by
-- running as a non-superuser role (`app`, = Supabase's `authenticated`).

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;

-- auth.users: only the columns our FKs and RPCs touch (id, email).
create table if not exists auth.users (
  id uuid primary key,
  email text
);

-- auth.uid() / auth.role(): driven by session GUCs the suite sets per "login".
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create or replace function auth.role() returns text
  language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated') $$;

-- storage surface used by 0009 (bucket registry, objects table, foldername()).
create table if not exists storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

-- realtime surface used by 0016. realtime.topic() reads the topic the platform
-- stamps per message; here the suite sets it via the test.topic GUC.
create or replace function realtime.topic() returns text
  language sql stable as $$ select nullif(current_setting('test.topic', true), '') $$;
create table if not exists realtime.messages (
  id bigint generated always as identity primary key,
  topic text not null,
  extension text not null,
  inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;

-- The application role. Supabase runs client SQL as `authenticated` (a member
-- of `anon`/`authenticated`); locally we mint one non-superuser role so RLS and
-- the `to authenticated` grants actually bite.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app') then
    create role app login;
  end if;
end $$;
grant authenticated to app;
grant usage on schema public, auth, storage, realtime to authenticated, anon, app;
-- Mirror Supabase: authenticated may use sequences/tables it's granted; RLS
-- still gates rows. Migrations grant EXECUTE on the RPCs to `authenticated`.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
