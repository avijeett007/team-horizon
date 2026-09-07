# Team Horizon

A lightweight shared availability calendar for Knotie and Hexai. People voluntarily add availability, tentative time, project commitments, and leave. The dashboard helps the team find useful overlaps without becoming an attendance or activity-tracking system.

## What is included

- Shared UK/India dashboard and weekly calendar
- Any number of split time blocks per day
- Optional weekday or weekly recurrence
- Confirmed and provisional leave
- Project colours and team filters
- Project-scoped member calendars: people see only colleagues assigned to the selected project
- One 40-hour Monday-to-Sunday availability target per person across all projects
- Outstanding weekly hours carry forward until covered; surplus hours are not banked
- Neutral seven-day “Needs an update” reminders
- Common-time finder for selected people
- Recognised-email access with self-only calendar changes
- One-PIN admin setup for people, ventures, and projects
- Weekly and monthly admin reports with CSV download
- Token-protected availability and report APIs for AI agents
- PostgreSQL persistence and a production Docker image

## Run locally

1. Create a PostgreSQL database, copy `.env.example` to `.env.local`, and replace the example values (especially `DATABASE_URL`).
2. Run `npm install`.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Open `/admin`, enter the configured PIN, and add Knotie, Hexai, projects, and team members.

The application automatically creates and migrates its `team_horizon` PostgreSQL schema on the first database-backed request. For isolated development or tests, `DATABASE_SCHEMA` can select another safe schema name.

## Deploy with Coolify

Create a PostgreSQL resource in Coolify, then create an application from this repository and select **Dockerfile** as the Build Pack. The included image uses Node 22 and contains no local database state.

- Exposed port: `3009`
- Host port mapping for this Nginx setup: `3009:3009`
- Health check path: `/api/health`
- Required environment values: `DATABASE_URL`, `ADMIN_PIN`, `SESSION_SECRET`
- Optional environment value: `AGENT_API_TOKEN`
- Optional environment value: `DATABASE_SCHEMA` (defaults to `team_horizon`)

The repository also contains a defensive `nixpacks.toml` pinned to Node 22. Dockerfile remains the recommended build method for a predictable runtime image. Backups and retention belong to the PostgreSQL service; redeploying the application container does not delete database rows.

If an earlier deployment already lost its SQLite file during redeployment, those deleted rows cannot be reconstructed by this migration. Re-enter the team setup once after connecting PostgreSQL; subsequent redeployments will reuse the external database.

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

Set `AGENT_API_TOKEN`, then read one project's availability with:

```text
GET /api/agent/availability?projectId=12&week=2026-09-07&from=2026-09-07T00:00:00.000Z&to=2026-09-14T00:00:00.000Z
Authorization: Bearer YOUR_TOKEN
```

`projectId` is required and limits the response to active members assigned to that project. Entries connected to another project remain visible as calendar constraints, but their project name and note are redacted. The optional `week` accepts any ISO date within the intended Monday-to-Sunday week and defaults to the current week in each member's timezone.

The `weeklyStatus` array contains each member's email, 40-hour base target, carried deficit, total target, available hours, remaining hours, Monday 09:00 local submission deadline, completion state, and `reminderNeeded` flag. Only entries marked `available` count. The calculation is global across the person's projects and overlapping availability counts once.

Reports use the same definitions:

```text
GET /api/agent/reports/weekly?projectId=12&week=2026-09-07
GET /api/agent/reports/monthly?projectId=12&month=2026-09
Authorization: Bearer YOUR_TOKEN
```

Monthly reports include weeks whose Monday falls in the selected month. The agent endpoints are read-only and disabled when the token is unset. Availability date ranges are limited to 366 days.

## Weekly availability accounting

- The standard target is currently 40 hours per person per week, across all projects combined.
- Each week runs from Monday 00:00 through Sunday 23:59 in the member's configured timezone.
- Tentative time, project/busy time, confirmed leave, and provisional leave do not count toward the target.
- If someone declares 30 hours, the next week's target is 50 hours. If they then declare 55 hours, the following target returns to 40 hours; extra time is not stored as future credit.
- Existing members begin accruing from the first Monday after the database migration. New members begin on the first Monday on or after their creation date, so deployment does not manufacture historical deficits.
- Admins can review the same global totals for a selected project's members under **Availability reports** and download the displayed rows as CSV.

## Checks

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e:postgres` (uses the ignored `.env.local` and a disposable PostgreSQL schema)
- `DATABASE_URL=postgresql://... sh scripts/docker-smoke.sh` when Docker is available
