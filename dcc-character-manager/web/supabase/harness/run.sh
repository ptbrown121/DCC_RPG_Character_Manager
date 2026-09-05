#!/usr/bin/env bash
# RLS / Realtime-authorization harness for the DCC manager.
#
# Spins up a throwaway Postgres cluster, stubs the slice of Supabase's managed
# schema our migrations depend on (00_prelude.sql), applies every migration in
# supabase/migrations in order, then runs the policy matrix (10_assertions.sql).
# Exits non-zero on the first failed assertion. Requires a local Postgres 15+
# (`initdb`, `pg_ctl`, `psql` on PATH — `brew install postgresql@17`).
#
#   supabase/harness/run.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"
PORT="${PGHARNESS_PORT:-54329}"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/dcc-harness.XXXXXX")"
PGDATA="$WORK/data"
# Unix sockets cap at ~104 bytes, so keep the socket dir short and separate.
SOCK="$(mktemp -d /tmp/dcch.XXXXXX)"

cleanup() {
  pg_ctl -D "$PGDATA" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf "$WORK" "$SOCK"
}
trap cleanup EXIT

echo "▸ initdb ($PGDATA)"
initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null

echo "▸ start postgres (socket $SOCK, port $PORT)"
pg_ctl -D "$PGDATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$WORK/pg.log" -w start >/dev/null

PSQL=(psql -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -U postgres -d harness -q)

echo "▸ create database"
psql -h "$SOCK" -p "$PORT" -U postgres -d postgres -q -c "create database harness;"

echo "▸ prelude"
"${PSQL[@]}" -f "$HERE/00_prelude.sql"

echo "▸ migrations"
for f in "$MIGRATIONS"/*.sql; do
  printf '   • %s\n' "$(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "▸ assertions"
# -a echoes the warnings (ok: … lines) so a run is auditable; ON_ERROR_STOP
# turns any raised FAIL into a non-zero exit.
"${PSQL[@]}" -f "$HERE/10_assertions.sql"

echo "✓ harness passed"
