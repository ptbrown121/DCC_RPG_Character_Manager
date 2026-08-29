-- Grinding/advancement timers and social state (popularity/worship/sponsors).
-- grind:  {"total": int, "today": int}   (per-skill hours live inside skills jsonb)
-- social: {"popularity": int, "top_ten": int|null, "bounty": text,
--          "sponsors": [{"name","floor","notes"}],
--          "deity": {"name","tier","streak","lapse"}}
alter table public.characters
  add column if not exists grind jsonb not null default '{"total":0,"today":0}'::jsonb,
  add column if not exists social jsonb not null default '{}'::jsonb;
