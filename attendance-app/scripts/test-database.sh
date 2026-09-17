#!/usr/bin/env bash

set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration_file="$app_dir/drizzle/0000_live_attendance.sql"
test_file="$app_dir/tests/db/attendance.sql"
container_name="attendance-db-test-${PPID}-${RANDOM}"

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

docker run \
  --detach \
  --rm \
  --name "$container_name" \
  --env POSTGRES_DB=attendance_test \
  --env POSTGRES_PASSWORD=attendance_test \
  --env POSTGRES_USER=attendance_test \
  postgres:16-alpine >/dev/null

for attempt in {1..30}; do
  if docker exec "$container_name" pg_isready \
    --dbname attendance_test \
    --host 127.0.0.1 \
    --username attendance_test >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 30 ]]; then
    echo "PostgreSQL test container did not become ready" >&2
    docker logs "$container_name" >&2
    exit 1
  fi

  sleep 1
done

if [[ ! -f "$migration_file" ]]; then
  echo "Missing migration: drizzle/0000_live_attendance.sql" >&2
  exit 1
fi

if [[ ! -f "$test_file" ]]; then
  echo "Missing database assertions: tests/db/attendance.sql" >&2
  exit 1
fi

docker exec --interactive "$container_name" psql \
  --dbname attendance_test \
  --set ON_ERROR_STOP=1 \
  --username attendance_test < "$migration_file"

docker exec --interactive "$container_name" psql \
  --dbname attendance_test \
  --set ON_ERROR_STOP=1 \
  --username attendance_test < "$test_file"
