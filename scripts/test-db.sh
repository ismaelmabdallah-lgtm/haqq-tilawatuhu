#!/usr/bin/env bash
# Rebuilds a throwaway database and runs: Supabase shim → migrations → seed → tests.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-haqq_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do
  echo "migrate: $f"; "${PSQL[@]}" -d "$DB" -f "$f"
done
for f in supabase/seed/*.sql; do
  echo "seed:    $f"; "${PSQL[@]}" -d "$DB" -f "$f"
done
"${PSQL[@]}" -d "$DB" -f supabase/tests/10_security_and_workflow.sql 2>&1 | tee /tmp/haqq-db-tests.log | grep -E 'PASS|FAIL|ERROR|ALL TESTS' || true
grep -q 'ALL TESTS PASSED' /tmp/haqq-db-tests.log || { echo "DB TESTS FAILED"; exit 1; }
echo "passed checks: $(grep -c 'PASS:' /tmp/haqq-db-tests.log)"
