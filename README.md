# Team Horizon

A lightweight shared availability calendar for Knotie and Hexai. People voluntarily add availability, tentative time, project commitments, and leave. The dashboard helps the team find useful overlaps without becoming an attendance or activity-tracking system.

## What is included

- Shared UK/India dashboard and weekly calendar
- Any number of split time blocks per day
- Optional weekday or weekly recurrence
- Confirmed and provisional leave
- Project colours and team filters
- Neutral seven-day “Needs an update” reminders
- Common-time finder for selected people
- Recognised-email access with self-only calendar changes
- One-PIN admin setup for people, ventures, and projects
- Optional, token-protected read-only availability API for AI agents
- SQLite persistence and a production Docker image

## Run locally

1. Copy `.env.example` to `.env.local` and replace the example values.
2. Run `npm install`.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Open `/admin`, enter the configured PIN, and add Knotie, Hexai, projects, and team members.

The local database is created at `data/team-calendar.db` unless `DATABASE_PATH` is changed.

## Deploy with Coolify

Create a new application from this repository and select **Dockerfile** as the Build Pack. Coolify defaults to Nixpacks, so change this field explicitly; the included Dockerfile uses the required Node 22 runtime and native SQLite build tools.

- Exposed port: `3009`
- Host port mapping for this Nginx setup: `3009:3009`
- Health check path: `/api/health`
- Persistent storage: mount a volume at `/app/data`
- Required environment values: `ADMIN_PIN`, `SESSION_SECRET`
- Optional environment value: `AGENT_API_TOKEN`
- Database path: the image already sets `DATABASE_PATH=/app/data/team-calendar.db`

The repository also contains a defensive `nixpacks.toml` pinned to Node 22. Dockerfile remains the recommended build method because it gives this SQLite application a predictable build and runtime image.

### Nginx domain proxy

The ready-to-use host configuration is at `deploy/nginx/teams.kno2gether.com.conf`. It proxies `teams.kno2gether.com` to the Coolify application on `127.0.0.1:3009`.

This configuration assumes Nginx owns ports 80/443 on the deployment server. In Coolify, set **Ports Exposes** to `3009` and **Ports Mappings** to `3009:3009` so the host Nginx process can reach the container. Do not also assign this domain through Coolify's default Traefik proxy.

On the server:

```bash
sudo cp deploy/nginx/teams.kno2gether.com.conf /etc/nginx/sites-available/teams.kno2gether.com
sudo ln -s /etc/nginx/sites-available/teams.kno2gether.com /etc/nginx/sites-enabled/teams.kno2gether.com
curl http://127.0.0.1:3009/api/health
sudo nginx -t
sudo systemctl reload nginx
```

After the DNS record points to the server, enable HTTPS with the server's existing certificate workflow. With Certbot this is:

```bash
sudo certbot --nginx -d teams.kno2gether.com
```

Use a long random value for `SESSION_SECRET`. The pilot deliberately does not verify member emails; it is intended for a trusted internal team. Add proper email-link sign-in before exposing it beyond that group.

## AI agent access

Set `AGENT_API_TOKEN`, then read availability with:

```text
GET /api/agent/availability?from=2026-09-01T00:00:00.000Z&to=2026-09-08T00:00:00.000Z
Authorization: Bearer YOUR_TOKEN
```

The endpoint is read-only and is disabled when the token is unset. Date ranges are limited to 366 days.

## Checks

- `npm test`
- `npm run typecheck`
- `npm run build`
- `sh scripts/docker-smoke.sh` when Docker is available
