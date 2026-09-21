#!/usr/bin/env bash
#
# End-to-end check of the specialty-scope enforcement through the real server.
#
# The unit tests call `createApp` directly with an in-memory session store, so
# they cannot catch a wiring mistake in `server/index.cjs` (a missing
# `config.nodeRed`, an unmounted proxy) or in the session store itself. This
# script boots the actual server process against a throwaway PostgreSQL and a
# stub of the two upstreams, then drives it over HTTP:
#
#   1. an unauthenticated gateway call is refused (the gateway is no longer
#      reachable without a session);
#   2. login resolves the session's specialty scope from the Inspector record;
#   3. a scoped `queryEntity` read drops the out-of-scope row and fixes `total`;
#   4. the gateway receives the API key and the session's own ticket, and never
#      the session cookie;
#   5. an out-of-scope write is refused and an in-scope write goes through.
#
# Alfresco and Node-RED are stubbed because their credentials are not part of
# this repository — everything else (server bootstrap, PostgreSQL session
# repository, cookies, proxy) is real. Requires Docker.
#
#   scripts/verify-specialty-scope-e2e.sh
#
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
PG_CONTAINER="compliance-web-scope-e2e-pg"
DB=compliance_web_e2e
STUB_PORT=4611
APP_PORT=4011

cleanup() {
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null
  [ -n "${STUB_PID:-}" ] && kill "$STUB_PID" 2>/dev/null
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

cat >"$WORK_DIR/stub-upstreams.cjs" <<'STUB'
// Stand-in for Alfresco + Node-RED: the ticket exchange and group lookup the
// login flow needs, Node-RED's inspector lookup, and the gateway entity routes.
const http = require('http');
const PORT = Number(process.env.STUB_PORT || 4611);
let lastRequest = null;

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === '/__last') return send(res, 200, lastRequest);
    lastRequest = { method: req.method, path: url.pathname, headers: req.headers, body: raw || null };

    if (url.pathname.includes('/authentication/versions/1/tickets')) return send(res, 201, { entry: { id: 'E2E-TICKET' } });
    // Both users have the same Inspector record; only their groups differ, which
    // is the whole point — the scope must follow the role, not the record.
    if (url.pathname.endsWith('/groups')) {
      const groups = url.pathname.includes('pablo.planner')
        ? [{ entry: { id: 'GROUP_INSPECTOR' } }, { entry: { id: 'GROUP_PLANNER' } }]
        : [{ entry: { id: 'GROUP_INSPECTOR' } }];
      return send(res, 200, { list: { entries: groups } });
    }
    if (url.pathname.startsWith('/inspector/')) {
      return send(res, 200, { id: 'insp-ana', name: 'Ana', specialties: [{ id: 'spec_ats', code: 'ATS', name: 'ATS' }] });
    }
    if (url.pathname === '/queryEntity' && url.searchParams.get('entity') === 'ChecklistQuestion') {
      return send(res, 200, {
        total: 2,
        list: [
          { id: 'q-ats', specialty: { id: 'spec_ats', code: 'ATS' } },
          { id: 'q-met', specialty: { id: 'spec_met', code: 'MET' } },
        ],
      });
    }
    if (url.pathname === '/addEntity') return send(res, 200, { id: 'added-1' });
    return send(res, 200, { ok: true, path: url.pathname });
  });
}).listen(PORT, '127.0.0.1', () => console.log(`stub upstreams on ${PORT}`));
STUB

echo "== throwaway PostgreSQL"
docker rm -f "$PG_CONTAINER" >/dev/null 2>&1
docker run -d --name "$PG_CONTAINER" -e POSTGRES_USER=compliance -e POSTGRES_PASSWORD=e2e \
  -e POSTGRES_DB="$DB" -p 5544:5432 postgres:16-alpine >/dev/null
for _ in $(seq 1 40); do
  docker exec "$PG_CONTAINER" pg_isready -U compliance -d "$DB" >/dev/null 2>&1 && break
  sleep 1
done
DATABASE_URL="postgres://compliance:e2e@127.0.0.1:5544/${DB}"

(cd "$REPO_DIR" && DATABASE_URL="$DATABASE_URL" npm run db:migrate >"$WORK_DIR/migrate.log" 2>&1) \
  || { echo "FAIL: migration"; tail -5 "$WORK_DIR/migrate.log"; exit 1; }
# The role mapping lives in the database, not in code. Two groups: one user works
# as an inspector, the other holds the planner role as well and must be unscoped.
docker exec "$PG_CONTAINER" psql -U compliance -d "$DB" -c \
  "INSERT INTO alfresco_group_role_map (alfresco_group, role_id) SELECT 'GROUP_INSPECTOR', id FROM app_role WHERE role_key='inspector' ON CONFLICT DO NOTHING;
   INSERT INTO alfresco_group_role_map (alfresco_group, role_id) SELECT 'GROUP_PLANNER', id FROM app_role WHERE role_key='planner' ON CONFLICT DO NOTHING;" >/dev/null

echo "== stub upstreams + real server"
STUB_PORT=$STUB_PORT node "$WORK_DIR/stub-upstreams.cjs" >"$WORK_DIR/stub.log" 2>&1 &
STUB_PID=$!
(
  cd "$REPO_DIR"
  DATABASE_URL="$DATABASE_URL" \
  ALFRESCO_BASE_URL="http://127.0.0.1:${STUB_PORT}" \
  NODE_RED_BASE_URL="http://127.0.0.1:${STUB_PORT}" \
  NODE_RED_API_KEY=e2e-key \
  AUTH_TICKET_ENCRYPTION_KEY=e2e-ticket-key \
  AUTH_SERVER_PORT=$APP_PORT \
  NODE_ENV=development \
  AUTH_COOKIE_SECURE=false \
  node server/index.cjs >"$WORK_DIR/server.log" 2>&1
) &
APP_PID=$!

for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:${APP_PORT}/health" >/dev/null && break
  sleep 1
done
curl -sf "http://127.0.0.1:${APP_PORT}/health" >/dev/null \
  || { echo "FAIL: server did not start"; tail -10 "$WORK_DIR/server.log"; exit 1; }

JAR="$WORK_DIR/cookies.txt"
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1 (expected $2, got $3)"; fail=$((fail+1)); fi; }

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${APP_PORT}/nodered/queryEntity?entity=ChecklistQuestion" -H 'Content-Type: application/json' -d '{}')
check "no session -> 401" 401 "$code"

curl -s -c "$JAR" -X POST "http://127.0.0.1:${APP_PORT}/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"ana.inspector","password":"secret"}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('  login scope:', data.get('specialtyScope'), '| ids:', data.get('specialtyScopeIds'))
sys.exit(0 if data.get('specialtyScope') == ['ATS'] else 1)
" || { echo "FAIL: login did not resolve the scope"; fail=$((fail+1)); }

curl -s -b "$JAR" -X POST "http://127.0.0.1:${APP_PORT}/nodered/queryEntity?entity=ChecklistQuestion" \
  -H 'Content-Type: application/json' -d '{"deleted":false}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
ids = [row.get('id') for row in data.get('list', [])]
print('  scoped read rows:', ids, '| total:', data.get('total'))
sys.exit(0 if ids == ['q-ats'] and data.get('total') == 1 else 1)
" && { echo "  ok   out-of-scope read row dropped"; pass=$((pass+1)); } || { echo "  FAIL read filtering"; fail=$((fail+1)); }

curl -s "http://127.0.0.1:${STUB_PORT}/__last" | python3 -c "
import json, sys
headers = json.load(sys.stdin).get('headers', {})
print('  gateway saw x-api-key:', headers.get('x-api-key'), '| ticket:', headers.get('x-alfresco-ticket'), '| cookie:', 'cookie' in headers)
sys.exit(0 if headers.get('x-api-key') == 'e2e-key' and headers.get('x-alfresco-ticket') == 'E2E-TICKET' and 'cookie' not in headers else 1)
" && { echo "  ok   api key + session ticket injected, cookie withheld"; pass=$((pass+1)); } || { echo "  FAIL header injection"; fail=$((fail+1)); }

code=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "http://127.0.0.1:${APP_PORT}/nodered/addEntity?entity=InspectedSpecialty" -H 'Content-Type: application/json' -d '{"specialtyId":"spec_met"}')
check "out-of-scope addEntity -> 403" 403 "$code"

code=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "http://127.0.0.1:${APP_PORT}/nodered/addEntity?entity=InspectedSpecialty" -H 'Content-Type: application/json' -d '{"specialtyId":"spec_ats"}')
check "in-scope addEntity -> 200" 200 "$code"

# Same Inspector record, same specialties — but this user also holds the planner
# role, so the session works as a planner and is not narrowed at all.
PLANNER_JAR="$WORK_DIR/cookies-planner.txt"
curl -s -c "$PLANNER_JAR" -X POST "http://127.0.0.1:${APP_PORT}/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"pablo.planner","password":"secret"}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('  planner roles:', data.get('roles'), '| scope:', data.get('specialtyScope'))
sys.exit(0 if sorted(data.get('roles') or []) == ['inspector', 'planner']
         and data.get('specialtyScope') is None and data.get('specialtyScopeIds') is None else 1)
" && { echo "  ok   inspector+planner login is unscoped"; pass=$((pass+1)); } || { echo "  FAIL planner scope"; fail=$((fail+1)); }

curl -s -b "$PLANNER_JAR" -X POST "http://127.0.0.1:${APP_PORT}/nodered/queryEntity?entity=ChecklistQuestion" \
  -H 'Content-Type: application/json' -d '{"deleted":false}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
ids = [row.get('id') for row in data.get('list', [])]
print('  planner read rows:', ids, '| total:', data.get('total'))
sys.exit(0 if ids == ['q-ats', 'q-met'] and data.get('total') == 2 else 1)
" && { echo "  ok   planner reads the row the inspector cannot"; pass=$((pass+1)); } || { echo "  FAIL planner read filtering"; fail=$((fail+1)); }

code=$(curl -s -o /dev/null -w '%{http_code}' -b "$PLANNER_JAR" -X POST "http://127.0.0.1:${APP_PORT}/nodered/addEntity?entity=InspectedSpecialty" -H 'Content-Type: application/json' -d '{"specialtyId":"spec_met"}')
check "planner writes outside the Inspector record's specialties -> 200" 200 "$code"

echo
echo "sandbox e2e: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
