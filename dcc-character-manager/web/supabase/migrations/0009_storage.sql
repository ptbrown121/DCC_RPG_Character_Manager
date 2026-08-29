-- Image assets (maps, tokens, item icons) live in Supabase Storage; one public
-- bucket with unguessable per-user paths ({owner_id}/{uuid}.webp). The app
-- always downscales client-side before upload (src/lib/upload.ts), so nothing
-- big ever lands here. An assets table row per object means the library UI
-- lists via Postgres, never via storage.list().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 5242880, '{image/webp,image/png,image/jpeg}')
on conflict (id) do nothing;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('map','token','item','misc')),
  name text not null,
  storage_path text not null,
  width int not null,
  height int not null,
  created_at timestamptz not null default now()
);

create index assets_campaign_idx on public.assets (campaign_id, kind);

alter table public.assets enable row level security;

create policy "assets owner all" on public.assets
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "assets member read" on public.assets
  for select using (public.is_campaign_member(campaign_id));

-- Storage object policies: the bucket is public-read (players load images by
-- URL, no auth); authenticated users may write/delete only inside their own
-- {auth.uid()}/ folder.
create policy "assets storage read" on storage.objects
  for select using (bucket_id = 'assets');
create policy "assets storage insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets storage update" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets storage delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
