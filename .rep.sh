for r in 1 2 3; do
  npx wrangler pages dev out --port 8799 --compatibility-date=2026-11-01 >/dev/null 2>&1 &
  for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8799/ && break; sleep 1; done
  echo "=== fresh server run $r"
  BASE_URL=http://localhost:8799 timeout 280 node tests/e2e/admin-flow.mjs 2>&1 | grep -E -A2 "✖|all checks passed"
  taskkill //F //IM workerd.exe >/dev/null 2>&1; pkill -f "wrangler pages dev" >/dev/null 2>&1; sleep 2
done
