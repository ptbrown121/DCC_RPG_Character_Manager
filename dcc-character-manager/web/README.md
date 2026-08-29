# DCC Character Manager — web app

Character manager and GM campaign tools for the Dungeon Crawler Carl RPG (Renegade Game
Studios). Next.js (App Router) + Tailwind + Supabase, deployed on Vercel. All rules data was
extracted from the owner's books into `../rules/` — those reference files are the source of
truth for any rules question; code comments cite them by section/table.

## Layout

- `src/lib/rules/` — pure, tested rules engine. One module per subsystem (stats, derived
  values, checks, conditions, adversary math, progression, campaign, social, assets) plus
  `catalog/` (skills, spells, races, classes, point-buy menus — game data as TS constants).
  Everything re-exported through `index.ts`; import via `@/lib/rules`. Tests live next to
  the code (`*.test.ts`, vitest, `npm test`).
- `src/lib/types.ts` — TypeScript row types matching the DB schema. jsonb columns are typed
  here (skills, spells, traits, grind, social, loot, companions, vehicles, bosses, npcs).
- `src/lib/supabase.ts` — browser Supabase client. Auth is email/password, client-side only
  (no SSR cookie plumbing); every page wraps in `<AuthGate>`.
- `src/components/` — shared panels (HbTracker, RaceClassPanel, FameFaithPanel,
  AssetsPanels, VehiclesPanel, CatalogSelect, AuthGate).
- `src/app/` — pages: `/` dashboard · `/login` · `/characters/new` + `/characters/[id]`
  (sheet) · `/encounters/new` + `/encounters/[id]` (runner) · `/campaigns/new` +
  `/campaigns/[id]` (tracker) + `/campaigns/[id]/areas/[areaId]` (neighborhood/quest editor).
- `supabase/migrations/` — 0001–0006, in order. All additive; RLS is owner-only
  (`auth.uid() = owner_id`) on every table. New schema = new numbered migration; the user
  runs them by pasting into the Supabase SQL editor.

## Conventions

- UI pattern: client components fetch on mount, optimistic-update local state, then persist
  via a `persist`/`patch` helper. No server components with data.
- The rules engine is the only place game math lives; UI calls it, never re-derives.
- Book misprints are preserved in catalog `note:` fields and surfaced as ⚠ in the UI.
- Supabase uses the **new API keys**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (`sb_publishable_...`). Never put an `sb_secret_` key in a `NEXT_PUBLIC_` var — the
  client throws if you do.

## Setup

1. Create a Supabase project; run `supabase/migrations/0001…0006` in the SQL editor.
2. Enable Email auth (confirmation off is convenient for local dev).
3. `cp .env.example .env.local`; fill the project URL + publishable key.
4. `npm install && npm run dev`

## Deploy (Vercel)

Root Directory = `dcc-character-manager/web`; set the two `NEXT_PUBLIC_SUPABASE_*` env vars;
add the Vercel URL to Supabase Auth → URL Configuration.

## Status

Everything in the reference files' data-model appendices is implemented: creation at all four
entry levels, skill/spell/race/class catalogs + point-buy, sheet trackers (HB, mana, debuffs,
grinding/advancement, fame/faith, loot boxes, companions), campaigns (floor collapse clocks,
neighborhood/quest template, bosses → one-click encounters), the encounter runner, vehicles.
Unbuilt ideas are polish: realtime sync between players/GM, detailed gear-slot inventory.
`npm run build && npm test && npm run lint` should all be green before handing work back.
