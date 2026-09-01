#!/bin/sh
set -eu

smoke_id="team-horizon-smoke-$$"
smoke_image="${smoke_id}:test"
smoke_container="${smoke_id}-container"
smoke_volume="${smoke_id}-data"

case "$smoke_id" in
  team-horizon-smoke-[0-9]*) ;;
  *) echo "Unsafe smoke-test name" >&2; exit 1 ;;
esac

cleanup() {
  docker rm -f "$smoke_container" >/dev/null 2>&1 || true
  docker volume rm "$smoke_volume" >/dev/null 2>&1 || true
  docker image rm "$smoke_image" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build -t "$smoke_image" .
docker volume create "$smoke_volume" >/dev/null
docker run -d --name "$smoke_container" -p 127.0.0.1::3009 \
  -e ADMIN_PIN=smoke-admin-pin \
  -e SESSION_SECRET=smoke-session-secret-at-least-32-characters \
  -e AGENT_API_TOKEN=smoke-agent-token \
  -v "$smoke_volume:/app/data" "$smoke_image" >/dev/null

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
  -v "$smoke_volume:/app/data" "$smoke_image" >/dev/null
smoke_port="$(docker port "$smoke_container" 3009/tcp | sed -n 's/.*://p')"
attempt=0
until response="$(curl -fsS "http://127.0.0.1:${smoke_port}/api/health" 2>/dev/null)"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then docker logs "$smoke_container"; exit 1; fi
  sleep 1
done
test "$response" = '{"ok":true}'
echo "Container health and persistent volume checks passed."
