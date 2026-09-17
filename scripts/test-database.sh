#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="aab-attendance-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
# No host ports or real data. This database exists only for the test run.
docker run --rm -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -v "$PWD:/work:ro" postgres:16 >/dev/null
for attempt in {1..60}; do
  # The initialization server accepts Unix sockets before its planned restart.
  # TCP is available only once the final server is running.
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.5
done
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -f /work/tests/database.sql
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -f /work/tests/expiry.sql
