#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container_name="attendance-e2e-${PPID}-${RANDOM}"
server_pid=""
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/attendance-e2e.XXXXXX")"

stop_server() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    server_pid=""
  fi
}
cleanup() {
  result=$?
  trap - EXIT
  stop_server
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  if [[ "$result" -ne 0 ]]; then
    cat "$runtime_dir"/*.log >&2 2>/dev/null || true
  fi
  rm -rf "$runtime_dir"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$app_dir"
if [[ ! -f .next/BUILD_ID ]]; then
  echo "Run npm run build before npm run test:e2e." >&2
  exit 1
fi

docker run --detach --rm --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB=attendance_e2e \
  --env POSTGRES_PASSWORD=attendance_e2e \
  --env POSTGRES_USER=attendance_e2e postgres:16-alpine >/dev/null

for attempt in {1..30}; do
  if docker exec "$container_name" pg_isready --dbname attendance_e2e \
    --host 127.0.0.1 --username attendance_e2e >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    docker logs "$container_name" >&2
    exit 1
  fi
  sleep 1
done
host_port="$(docker port "$container_name" 5432/tcp | sed -n 's/^127\.0\.0\.1://p')"
[[ "$host_port" =~ ^[0-9]+$ ]]
docker exec --interactive "$container_name" psql --dbname attendance_e2e \
  --username attendance_e2e --set ON_ERROR_STOP=1 \
  < drizzle/0000_live_attendance.sql > "$runtime_dir/migration.log"

export DATABASE_URL="postgresql://attendance_e2e:attendance_e2e@127.0.0.1:${host_port}/attendance_e2e"
export NEXTAUTH_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export RATE_LIMIT_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export GITHUB_ID="e2e-synthetic-client"
export GITHUB_SECRET="e2e-synthetic-secret"
export PROFESSOR_GITHUB_ID="900000001"
export E2E_DISPOSABLE_DATABASE=1
export NODE_ENV=production

start_server() {
  local mode="$1"
  local port
  port="$(node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})')"
  export NEXTAUTH_URL="http://127.0.0.1:${port}"
  export E2E_BASE_URL="$NEXTAUTH_URL"
  node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$port" \
    > "$runtime_dir/$mode.log" 2>&1 &
  server_pid=$!
  for attempt in {1..60}; do
    if ! kill -0 "$server_pid" 2>/dev/null; then
      echo "Next server exited during $mode startup." >&2
      return 1
    fi
    if curl --silent --fail --max-time 2 "$E2E_BASE_URL/" >/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  echo "Next server did not become ready during $mode." >&2
  return 1
}

assert_session_status() {
  local expected="$1"
  local actual
  actual="$(curl --silent --show-error --max-time 10 --output "$runtime_dir/session.json" \
    --write-out '%{http_code}' --header 'content-type: application/json' \
    --data '{"persona":"studentOne"}' "$E2E_BASE_URL/api/test/session")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Test session guard: expected $expected, received $actual." >&2
    cat "$runtime_dir/session.json" >&2
    return 1
  fi
}

# Assert the deployed production server cannot mint test sessions, even if opted in.
export E2E_TEST_AUTH=1
export VERCEL=1
start_server vercel-production
assert_session_status 404
stop_server
export VERCEL=""
start_server vercel-present-empty
assert_session_status 404
stop_server
unset VERCEL E2E_TEST_AUTH
start_server production-default
assert_session_status 404
stop_server

# Deliberate local test mode uses the same compiled production build.
export E2E_TEST_AUTH=1
start_server local-e2e
assert_session_status 200
printf '%s\n' 'Test-session guards passed (VERCEL=1, VERCEL empty, auth disabled, local opt-in).'
npx playwright test "$@"
