#!/usr/bin/env bash

set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration_file="$app_dir/drizzle/0000_live_attendance.sql"
container_name="attendance-integration-${PPID}-${RANDOM}"
host_port=""
vitest_config="$app_dir/.vitest-integration-${PPID}-${RANDOM}.mts"

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  rm -f "$vitest_config"
}

trap cleanup EXIT INT TERM

docker run \
  --detach \
  --rm \
  --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB=attendance_test \
  --env POSTGRES_PASSWORD=attendance_test \
  --env POSTGRES_USER=attendance_test \
  postgres:16-alpine >/dev/null

for attempt in {1..30}; do
  host_port="$(docker port "$container_name" 5432/tcp 2>/dev/null | sed -n 's/.*://p' | head -n 1)"
  if [[ -n "$host_port" ]] && docker exec "$container_name" pg_isready \
    --dbname attendance_test \
    --host 127.0.0.1 \
    --username attendance_test >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 30 ]]; then
    echo "PostgreSQL integration container did not become ready" >&2
    docker logs "$container_name" >&2
    exit 1
  fi

  sleep 1
done

if [[ ! -f "$migration_file" ]]; then
  echo "Missing migration: drizzle/0000_live_attendance.sql" >&2
  exit 1
fi

docker exec --interactive "$container_name" psql \
  --dbname attendance_test \
  --set ON_ERROR_STOP=1 \
  --username attendance_test < "$migration_file" >/dev/null

for migration in "$app_dir"/drizzle/000[1-9]*.sql; do
  [[ -f "$migration" ]] || continue
  docker exec --interactive "$container_name" psql --dbname attendance_test --set ON_ERROR_STOP=1 --username attendance_test < "$migration" >/dev/null
done

export DATABASE_URL="postgresql://attendance_test:attendance_test@127.0.0.1:${host_port}/attendance_test"
export NEXTAUTH_URL="http://127.0.0.1:3000"
export NEXTAUTH_SECRET="integration-nextauth-secret"
export GITHUB_ID="integration-github-client"
export GITHUB_SECRET="integration-github-secret"
export PROFESSOR_GITHUB_ID="100"
export RATE_LIMIT_SECRET="integration-rate-limit-secret"

printf '%s\n' \
  'import { defineConfig } from "vitest/config";' \
  'export default defineConfig({' \
  "  resolve: { alias: { \"@\": \"$app_dir\" } }," \
  '  test: {' \
  '    environment: "node",' \
  '    include: ["tests/integration/**/*.test.ts"],' \
  '    maxWorkers: 1,' \
  '    fileParallelism: false,' \
  '  },' \
  '});' > "$vitest_config"

cd "$app_dir"
npx vitest run --config "$vitest_config" tests/integration/attendance.test.ts
