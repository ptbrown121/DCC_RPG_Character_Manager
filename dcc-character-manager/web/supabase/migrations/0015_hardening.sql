-- 0015: write-policy hardening (T13).
-- The owner-all policies on maps / assets / tokens only required
-- owner_id = auth.uid() in WITH CHECK, so any campaign MEMBER could insert
-- rows they own into the GM's campaign (catalog items got this fix in 0012).
-- Vandalism-only among friends, but wrong: writes now also require owning
-- the campaign. Reads (member SELECT policies) are unchanged, and the GM's
-- flows are unaffected — they own their campaigns.

drop policy "maps owner all" on public.maps;
create policy "maps owner all" on public.maps
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and public.owns_campaign(campaign_id));

drop policy "assets owner all" on public.assets;
create policy "assets owner all" on public.assets
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and public.owns_campaign(campaign_id));

-- Tokens hang off maps; the subquery runs under the caller's RLS, which the
-- campaign owner passes for their own maps.
drop policy "tokens owner all" on public.tokens;
create policy "tokens owner all" on public.tokens
  for all using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.maps m
      where m.id = map_id and public.owns_campaign(m.campaign_id)
    )
  );
