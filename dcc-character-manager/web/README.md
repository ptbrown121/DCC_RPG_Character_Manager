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
- `src/lib/upload.ts` — image asset pipeline (migration 0009): every upload is
  downscaled client-side (canvas → webp, maps ≤ 2560px, tokens/item icons ≤ 512px)
  before landing in the public `assets` Storage bucket under `{auth.uid()}/{uuid}.webp`
  (paths unguessable; storage policies restrict writes to your own folder). Each object
  gets a row in the `assets` table (kind: map/token/item/misc, campaign-scoped,
  member-readable) so the UI lists via Postgres, never `storage.list()`. Use
  `uploadAsset`/`assetUrl`/`deleteAsset` — never upload originals directly.
- `src/lib/supabase.ts` — browser Supabase client. Auth is email/password or Google OAuth
  (PKCE, handled entirely client-side — no SSR cookie plumbing, no callback route; the
  browser client auto-exchanges the `?code=` on return). Every page wraps in `<AuthGate>`.
  Google requires the provider enabled in Supabase plus the site URLs (localhost + Vercel)
  in Auth → URL Configuration → Redirect URLs.
- `src/components/` — shared panels (HbTracker, RaceClassPanel, FameFaithPanel,
  AssetsPanels, VehiclesPanel, CatalogSelect, AuthGate, NavBar) plus `Hud.tsx`: the
  in-fiction HUD chrome on the character sheet (book default layout — notifications ↖,
  HP/MP bars + collapse timer ↗, 10-slot Hotlist ↓, minimap ↘; elements idle dimmed and
  focus on hover). `Hud.tsx` also holds the Supabase Realtime plumbing: the GM's "System
  Send" panel (campaign page) broadcasts messages/images to `hud:campaign:<id>` (party)
  or `hud:character:<id>` (private), and can push a `hud_config` that switches HUD
  elements off on player screens. Sends are ephemeral broadcast — no tables involved,
  receiving sheets must be open, and private targeting is client-side convenience, not a
  security boundary. The exception is the **Area feed** (`SceneStage`): a persistent
  map/monster image saved to `campaigns.scene` (migration 0007) and displayed
  center-stage on every party sheet; live updates ride the same channel, while reloads
  and late joiners read the campaign row. The sheet has a 🎮 PLAY / 🛠 MANAGE toggle —
  play mode hides all bookkeeping sections (stats editing, race/class, fame, loot,
  companions, wallet, notes) to leave room for the HUD and Area feed.
- `src/app/` — pages: `/` dashboard · `/login` · `/characters/new` + `/characters/[id]`
  (sheet) · `/encounters/new` + `/encounters/[id]` (runner) · `/campaigns/new` +
  `/campaigns/[id]` (tracker) + `/campaigns/[id]/areas/[areaId]` (neighborhood/quest editor).
- `supabase/migrations/` — 0001–0009, in order (0009 also creates the `assets`
  storage bucket + its `storage.objects` policies via SQL — no dashboard steps). All additive. RLS baseline is owner-only
  (`auth.uid() = owner_id`); migration 0008 layers **campaign membership** on top: players
  join with a short code (`join_campaign(code)` RPC, shown in the campaign page's Party
  header) and members get read access to the campaign row (incl. scene), floors, areas,
  and the party's characters, while the GM gets read access to members' linked characters
  (+ `kick_member` RPC that also unlinks their crawlers). Policies cross the
  campaigns ⇄ members tables via SECURITY DEFINER helpers (`is_campaign_member`,
  `owns_campaign`) to avoid RLS recursion. All writes stay owner-only. New schema = new
  numbered migration; the user runs them by pasting into the Supabase SQL editor.

## Conventions

- UI pattern: client components fetch on mount, optimistic-update local state, then persist
  via a `persist`/`patch` helper. No server components with data.
- The rules engine is the only place game math lives; UI calls it, never re-derives.
- Book misprints are preserved in catalog `note:` fields and surfaced as ⚠ in the UI.
- Supabase uses the **new API keys**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (`sb_publishable_...`). Never put an `sb_secret_` key in a `NEXT_PUBLIC_` var — the
  client throws if you do.

## Setup

1. Create a Supabase project; run `supabase/migrations/0001…0009` in the SQL editor.
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
