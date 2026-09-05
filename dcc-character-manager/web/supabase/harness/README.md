# RLS / Realtime authorization harness

Proves the row-level-security and Realtime-authorization policies in
`../migrations/` actually behave, without touching a real Supabase project.
This is the committed form of the throwaway-Postgres harness the migrations
were developed against — run it before adding or editing any migration.

```bash
npm run harness          # from web/
# or:
supabase/harness/run.sh
```

## What it does

1. `initdb` a throwaway Postgres cluster in a temp dir (auto-removed on exit).
2. Apply `00_prelude.sql` — a **stub** of the slice of Supabase's managed
   schema the migrations depend on: `auth.users`, `auth.uid()` (driven by a
   `test.uid` GUC so the suite can play different users), the `storage` and
   `realtime` surfaces, and the `authenticated`/`app` roles so RLS and the
   `to authenticated` grants actually bite. None of this ships to Supabase.
3. Apply every `../migrations/*.sql` in order, as they'd run in the SQL editor.
4. Run `10_assertions.sql`: seed a GM, a member, and a stranger, then assert
   the policy matrix. `psql -v ON_ERROR_STOP=1` turns any raised `FAIL:` into a
   non-zero exit; each pass logs an `ok:` line so a run is auditable.

## Coverage

- **Realtime authorization (0016)** — `realtime_topic_access()` across every
  topic family: campaign HUD (GM publishes, members receive, strangers denied),
  private character HUD (owner receives, that campaign's GM publishes),
  GM-only map/draw/mapmeta lifecycle topics, everyone-may-publish
  moves/aoe/ping topics, and rejection of malformed / unknown / signed-out
  topics. Also checks both `realtime.messages` policies exist.
- **Write hardening (0012/0015)** — a member cannot insert a map or asset into
  the GM's campaign even while spoofing `owner_id`.
- **SECURITY DEFINER RPCs** — `move_token` and `grant_item` reject a caller who
  is neither the owner nor the campaign's GM.

## Requirements

A local Postgres 15+ on `PATH` (`initdb`, `pg_ctl`, `psql`). On macOS:
`brew install postgresql@17`. Override the port with `PGHARNESS_PORT` if 54329
is taken.

## Keep it honest

The prelude is a stub, not Supabase. It deliberately models only what the
migrations touch; if a migration starts using a new `auth`/`storage`/`realtime`
object, add it to `00_prelude.sql`. The matrix is only as good as its
assertions — when you add a policy, add the row that would fail without it
(a quick way to check: break the policy, confirm the harness goes red).
