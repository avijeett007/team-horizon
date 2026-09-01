# Team Availability Calendar — Design

## Purpose

Create a lightweight shared calendar for Knotie and Hexai. Team members voluntarily declare when they are available, busy on a project, tentative, or on leave. The system helps people and AI agents find suitable times for meetings and work assignments. It is not an attendance, productivity, or activity-tracking system.

## Product principles

- Fast enough to update in under a minute.
- Everyone may see the team's declared availability.
- A recognised member may change only entries attached to their email.
- No password or email verification in the pilot. This trusted-team trade-off is stated in the interface.
- No timers, screenshots, activity collection, attendance scores, or compliance language.
- UK and India schedules must remain understandable in either local time zone.

## Users and access

### Team member

The welcome screen accepts an email address. If it matches an active member record, the app stores that identity in an HTTP-only browser cookie. The member can view all schedules and add, edit, or remove only their own calendar entries. Entering an email is identification, not secure authentication; a person who knows another member's email could impersonate them.

### Administrator

The admin area is protected by one shared PIN supplied through the `ADMIN_PIN` environment variable. An administrator can add and archive members, set names, emails, ventures, time zones, locations, and project memberships, and create or archive projects with calendar colours.

### AI agent

A read-only JSON endpoint exposes active people, projects, and availability over a bounded date range. It accepts an optional bearer token from `AGENT_API_TOKEN`. If no token is configured, the endpoint is disabled. It never permits writes.

## Core experience

### Dashboard

The first screen answers four questions:

1. Who is available now?
2. Who is on leave or unavailable today?
3. When is the next useful overlap for selected people?
4. Who has not declared any availability or leave in the next seven days?

The “Needs an update” panel is a neutral data-completeness signal. It never calls someone late or absent. Its reminder action opens the user's email application with a short pre-filled message; the server sends no email.

The visual signature is a “team horizon”: a 24-hour horizontal band showing UK and India working-time context and today's declared availability blocks.

### Calendar

The week view shows people as rows and days as columns. A day may contain any number of split entries. Users can filter by venture, project, person, location, and status, and switch the display zone between their local zone, UK time, and India time.

Clicking a day opens a compact entry editor. An entry contains:

- start and end date/time;
- status: available, tentative, busy/project work, or leave;
- optional project;
- optional note;
- optional recurrence: none, weekdays, weekly, or selected weekdays;
- recurrence end date when recurrence is used;
- leave certainty: confirmed or provisional.

Recurring entries are stored as a series plus exceptions. The pilot supports editing or deleting one occurrence or the whole series.

### Common-time finder

The user chooses two or more people, a date range of up to 31 days, a minimum duration, and a display time zone. The server intersects their declared `available` and `tentative` windows, subtracts busy and leave windows, and returns ranked common slots. Confirmed availability ranks ahead of tentative availability. No default working hours are inferred when a person has not entered data.

## Data model

SQLite is the source of truth. Timestamps are stored as UTC ISO-8601 values and rendered in the selected IANA time zone.

- `ventures`: id, name, colour, active, timestamps.
- `projects`: id, venture_id, name, colour, active, timestamps.
- `members`: id, name, email (unique, case-insensitive), location, timezone, active, timestamps.
- `member_ventures`: member_id, venture_id.
- `member_projects`: member_id, project_id.
- `calendar_series`: id, member_id, project_id nullable, status, note, leave_certainty nullable, timezone, local_start_time, local_end_time, recurrence_rule nullable, recurrence_until nullable, timestamps.
- `calendar_entries`: id, member_id, series_id nullable, project_id nullable, status, note, leave_certainty nullable, starts_at_utc, ends_at_utc, original_date, timestamps.
- `series_exceptions`: series_id, occurrence_date, action, replacement_entry_id nullable.

Foreign keys are enabled. Member and project records are archived rather than deleted when referenced by calendar history.

## Architecture

- Next.js application with TypeScript, React, and server route handlers.
- SQLite through `better-sqlite3`, with migrations run idempotently at startup.
- Server-side validation with Zod.
- HTTP-only member cookie and an HTTP-only admin-cookie created after PIN entry.
- CSS modules/global tokens with no heavyweight component framework.
- Docker multi-stage build suitable for Coolify.
- Database location configured by `DATABASE_PATH`, defaulting to `./data/team-calendar.db`; Coolify should mount `/app/data` as a persistent volume.
- Health endpoint at `/api/health` for Coolify.

## API boundaries

- `/api/session`: recognise/forget a member by email.
- `/api/dashboard`: dashboard summary for the selected date and zone.
- `/api/members`, `/api/projects`, `/api/ventures`: visible active reference data; admin mutations require the admin cookie.
- `/api/entries`: bounded list query; member-owned create/update/delete.
- `/api/common-time`: calculated overlap slots.
- `/api/admin/session`: establish or clear an admin session using the configured PIN.
- `/api/agent/availability`: token-protected read-only availability data.
- `/api/health`: database and process health.

All mutation endpoints validate ownership server-side. Date-range queries are bounded to prevent accidental unbounded reads.

## Visual direction

The interface should feel like a quiet planning surface, not enterprise monitoring software.

- Palette: midnight blue `#15243A`, sky `#DCEBFF`, mist `#F5F8FC`, coral `#F27D68`, leaf `#4E9C81`, and ink `#18202A`, with project colours chosen from an accessible set.
- Typography: Fraunces for restrained display moments, Inter for interface text, and IBM Plex Mono for time labels.
- Layout: a wide responsive planning canvas with the team horizon at the top, compact summary cards below, and the calendar as the main working surface.
- Motion: one short horizon reveal and restrained hover/focus transitions, disabled under reduced-motion preferences.
- Mobile: dashboard cards stack; calendar becomes a horizontally scrollable week grid with sticky person labels; editing uses a bottom sheet.

## Error handling

- Unknown email: explain that an administrator must add the address, preserving the typed email.
- Overlapping entries: allowed, because a person may be available while assigned to a project; conflicts are visually indicated and busy/leave subtract from common-time calculations.
- End before start, invalid time zone, or invalid recurrence: reject with a field-specific message.
- Database unavailable: health check fails and the UI shows a retryable service message.
- Missing agent token: agent endpoint returns unavailable, not public data.

## Testing and acceptance

Automated tests cover:

- member recognition and ownership enforcement;
- split blocks and cross-midnight entries;
- recurrence expansion and exceptions across UK daylight-saving changes;
- leave subtraction and common-time intersection;
- neutral “needs update” calculation;
- admin PIN protection;
- disabled and enabled agent endpoint behaviour;
- schema migration and health response.

The release is accepted when an administrator can add the two ventures, projects, and members; a member can identify by email and maintain multiple blocks; the dashboard and calendar reflect changes; common slots are correct across London and Kolkata; the agent endpoint is read-only; the production Docker image builds; and data survives container restart when a volume is mounted.

## Deferred intentionally

Email magic links, SSO, per-venture visibility, automated email delivery, notifications, external calendar sync, task management, timesheets, attendance reporting, and productivity analytics are outside the pilot.
