-- Race/class traits applied to a character (picklist or point-buy).
-- {"race": {"name","abilities":[],"drawbacks":[],"custom":bool},
--  "class": {"name","abilities":[],"drawbacks":[],"custom":bool}}
alter table public.characters
  add column if not exists traits jsonb not null default '{}'::jsonb;
