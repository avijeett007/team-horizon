#!/bin/sh
set -eu

: "${DATABASE_URL:?Set DATABASE_URL to a disposable PostgreSQL test database}"

smoke_id="team-horizon-smoke-$$"
smoke_image="${smoke_id}:test"
smoke_container="${smoke_id}-container"
smoke_schema="team_horizon_docker_smoke_$$"

case "$smoke_id" in
  team-horizon-smoke-[0-9]*) ;;
  *) echo "Unsafe smoke-test name" >&2; exit 1 ;;
esac

cleanup() {
  docker rm -f "$smoke_container" >/dev/null 2>&1 || true
  docker image rm "$smoke_image" >/dev/null 2>&1 || true
  DATABASE_SCHEMA="$smoke_schema" node --input-type=module -e '
    import pg from "pg";
    const schema = process.env.DATABASE_SCHEMA;
    if (!/^team_horizon_docker_smoke_[0-9]+$/.test(schema)) process.exit(1);
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } finally { await pool.end(); }
  ' >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build -t "$smoke_image" .
docker run -d --name "$smoke_container" -p 127.0.0.1::3009 \
  -e ADMIN_PIN=smoke-admin-pin \
  -e SESSION_SECRET=smoke-session-secret-at-least-32-characters \
  -e AGENT_API_TOKEN=smoke-agent-token \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DATABASE_SCHEMA="$smoke_schema" \
  "$smoke_image" >/dev/null

smoke_port="$(docker port "$smoke_container" 3009/tcp | sed -n 's/.*://p')"
test -n "$smoke_port"

attempt=0
until response="$(curl -fsS "http://127.0.0.1:${smoke_port}/api/health" 2>/dev/null)"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then docker logs "$smoke_container"; exit 1; fi
  sleep 1
done
test "$response" = '{"ok":true}'

docker stop "$smoke_container" >/dev/null
docker rm "$smoke_container" >/dev/null
docker run -d --name "$smoke_container" -p 127.0.0.1::3009 \
  -e ADMIN_PIN=smoke-admin-pin \
  -e SESSION_SECRET=smoke-session-secret-at-least-32-characters \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DATABASE_SCHEMA="$smoke_schema" \
  "$smoke_image" >/dev/null
smoke_port="$(docker port "$smoke_container" 3009/tcp | sed -n 's/.*://p')"
attempt=0
until response="$(curl -fsS "http://127.0.0.1:${smoke_port}/api/health" 2>/dev/null)"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then docker logs "$smoke_container"; exit 1; fi
  sleep 1
done
test "$response" = '{"ok":true}'
echo "Container health and PostgreSQL restart checks passed."
