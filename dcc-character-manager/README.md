# DCC RPG Character Manager

A character manager and GM campaign tool for the **Dungeon Crawler Carl RPG** (Renegade Game
Studios), covering both sides of the table:

**For crawlers 🐾**
- Character creation at all four entry points (Level 1 / 10 / 20 / 30) with the standard
  array or random stats, and skill/spell picklists from the full catalogs
- Live character sheet: both stat layers with auto-derived values, clickable Health Bar
  slots with DR-aware damage math, mana + spellcasting, debuffs, rests
- Race & class selection (30 races, 52 classes) with one-click application of stat bonuses
  and skill grants — or build your own with the 25/30 Build Point system
- Advancement: skill marks, grind-hour timers with roll helpers, level-from-grinding,
  end-of-block/end-of-floor advancement checks
- Fame & Faith (popularity, fan boxes, Top Ten, sponsors, worship/tithes/boons), loot box
  log, and companions (pet taming/leveling, mounts, minions)

**For the GM ⚔**
- Campaigns → floors with collapse clocks (30-hour dungeon days) → neighborhoods & quests
  using the book's write-up template, with structured bosses (clues, phases) and NPCs
- One-click **"Run as encounter"** on any boss: generates its stat block from the GM
  formulas and pulls in the whole party
- Encounter builder/runner: party-size encounter scaling, formula-driven mob/boss
  generator, per-mob Health Bar tracks, mob action budgets, the 5-step round structure
- Achievements log and a vehicle garage (ramming math included, explosions guaranteed)

## Repo layout

- [`web/`](web/) — the app: Next.js + Tailwind + Supabase, deployable on Vercel. Setup,
  architecture, and conventions in its [README](web/README.md).
- [`rules/`](rules/) — the rules knowledge base the app was built from (consolidated
  reference docs + raw extraction notes). See its [README](rules/README.md) for which
  document is canonical when.

## Quick start

```bash
cd web
cp .env.example .env.local   # add your Supabase URL + publishable key
npm install
npm run dev
```

Requires a free [Supabase](https://supabase.com) project — run the SQL files in
`web/supabase/migrations/` (0001–0006, in order) and enable Email auth. Full steps in the
[web README](web/README.md).

## Disclaimer

This is an unofficial, fan-made tool for personal use. It is not affiliated with or endorsed
by Renegade Game Studios or Matt Dinniman. The Dungeon Crawler Carl RPG and all related
material are the property of their respective owners — **you need the actual books to play**;
this tool is a bookkeeping companion, not a replacement for them.
