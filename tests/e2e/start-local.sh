#!/usr/bin/env bash
# OUTIL DE TEST UNIQUEMENT.
# Démarre : PostgreSQL jetable (+ migrations réelles) → backend de test local → serveur Vite.
# Prérequis : binaires PostgreSQL 15+ (PG_BIN), Node 20+.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
WORK="${WORK:-$(mktemp -d)}"
PGPORT="${PGPORT:-55433}"

if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUN=(su postgres -s /bin/bash -c); else RUN=(bash -c); fi
"${RUN[@]}" "'$PG_BIN/initdb' -D '$WORK/data' -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"
"${RUN[@]}" "'$PG_BIN/pg_ctl' -D '$WORK/data' -o '-p $PGPORT -k $WORK -c listen_addresses=127.0.0.1' -l '$WORK/pg.log' -w start >/dev/null"

PSQL=("$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -c "create schema test_auth; create table test_auth.passwords (user_id uuid primary key references auth.users(id) on delete cascade, hash text not null);"
echo "PostgreSQL prêt sur 127.0.0.1:$PGPORT (données : $WORK)"
echo "$WORK" > /tmp/claude-0/sos-e2e-work 2>/dev/null || true
