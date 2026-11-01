#!/usr/bin/env bash
# Exécute les migrations + les tests SQL sur une instance PostgreSQL locale jetable.
# Prérequis : binaires PostgreSQL 15+ (initdb, pg_ctl, psql) dans le PATH
# ou PG_BIN=/usr/lib/postgresql/16/bin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}"
WORK="$(mktemp -d)"
PORT="${PORT:-55432}"
if [ "$(id -u)" = "0" ]; then
  echo "Exécution en root détectée : utilisation de l'utilisateur 'postgres'." >&2
  chown -R postgres "$WORK" 2>/dev/null || true
  RUN=(su postgres -s /bin/bash -c)
else
  RUN=(bash -c)
fi
cleanup() { "${RUN[@]}" "'$PG_BIN/pg_ctl' -D '$WORK/data' -m fast stop" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN[@]}" "'$PG_BIN/initdb' -D '$WORK/data' -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"
"${RUN[@]}" "'$PG_BIN/pg_ctl' -D '$WORK/data' -o '-p $PORT -k $WORK' -l '$WORK/pg.log' -w start >/dev/null"

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ tests"
"${PSQL[@]}" -t -A -f "$ROOT/supabase/tests/10_workflow_rls_test.sql"
