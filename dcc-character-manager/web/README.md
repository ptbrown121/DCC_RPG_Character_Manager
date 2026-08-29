# DCC Character Manager

Character manager and GM campaign tools for the Dungeon Crawler Carl RPG (Renegade Game
Studios). Next.js + Supabase, deployable on Vercel. Rules data extracted in `../rules/`.

## What's here (v0)

- **Rules engine** (`src/lib/rules/`): pure, tested functions for the game math —
  stat mods, derived values (Health = CON Mod × 10, Mana = INT score, Evade = DEX Mod),
  check difficulties and degrees of success, damage mitigation and slot-based HB damage,
  the 27-debuff catalog, mob/boss builder math (HB slots, stat budgets, Surprise/Evade/DR,
  damage dice Table 51, Boss Severity Table 50), encounter sizing (Table 49), advancement.
- **Character model**: create crawlers at any entry point (Level 1/10/20/30), track both
  stat layers, HB slots, Mana, AI Favor, skills with advancement marks, debuffs, gold/junk,
  rests and the Heal spell.
- **Encounter runner**: build encounters with the Table 49 sizing calculator and a
  formula-driven mob/boss generator; run combat with per-mob HB slot tracks, DR-aware
  damage application, action budgets (1+1 vs. 1-per-crawler), debuff tags, and the
  5-step round structure.

## Setup

1. Create a Supabase project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. Enable Email auth (Authentication → Providers → Email). For local convenience you can
   turn off email confirmation.
4. `cp .env.example .env.local` and fill in the project URL and anon key.
5. `npm install && npm run dev`

## Deploy to Vercel

- Import the repo; set the **Root Directory** to `dcc-character-manager/web`.
- Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables.
- Add your Vercel URL to Supabase Auth → URL Configuration → Redirect URLs.

## Tests

```
npm test
```

## Not built yet

Race/class catalogs and point-buy builder, spell/skill catalogs as picklists, campaign &
neighborhood tracker (floors, quests, timers), grinding/advancement timers, popularity/
worship/sponsor state, loot boxes. The data models for all of these are specified in
`../rules/*.md` §data-model sections.
