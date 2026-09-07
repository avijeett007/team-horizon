# PostgreSQL Migration and Entry Editor Reliability — Design

## Purpose

Move Team Horizon from container-local SQLite storage to PostgreSQL so Coolify redeployments do not erase team data. At the same time, remove the accidental dependency between weekly-status loading and opening the availability editor.

## Confirmed editor regression

The `＋` button currently calls `setEditorDate`, so the click handler works. `CalendarApp` renders `EntryEditor` only when both `editorDate` and `weeklyStatus` are truthy. If `/api/weekly-status` is unavailable, slow, or returns an error, the selected date changes but no modal appears. The same missing status also removes the weekly progress element, matching the supplied screenshot.

The fix is to render the editor whenever `editorDate` exists. `weeklyStatus` becomes optional presentation data: when present, the editor shows the remaining-hours preview; when absent, it says the weekly total will refresh after saving. A status API failure must never prevent creating, editing, or deleting a declaration.

## Database architecture

### Runtime contract

- PostgreSQL becomes the only runtime database.
- `DATABASE_URL` is required for any request that uses persistence.
- `DATABASE_SCHEMA` is optional and defaults to `team_horizon`. It exists to isolate automated development tests; production normally sets only `DATABASE_URL`.
- Schema names must match `^[a-z_][a-z0-9_]*$` before being used in connection options or test setup.
- Connection pooling uses the `pg` package and one process-global `Pool` in development/production.
- The pool and its one-time migration promise survive Next.js development reloads through typed `globalThis` fields.
- Build-time module loading does not connect to PostgreSQL. The first database-backed request creates the pool, creates the validated application schema when absent, and runs migrations.
- Startup errors name the missing variable or database connection problem without logging credentials.

### PostgreSQL schema

The existing logical model remains unchanged:

- `schema_migrations`
- `ventures`
- `projects`
- `members`
- `member_ventures`
- `member_projects`
- `calendar_series`
- `calendar_entries`
- `series_exceptions`

PostgreSQL-native types replace SQLite conventions:

- generated integer identity columns for primary keys;
- `BOOLEAN` for active flags;
- `TIMESTAMPTZ` for stored UTC instants and audit timestamps;
- `DATE` for local dates and recurrence limits;
- `TEXT` for names, colours, statuses, notes, timezones, and recurrence JSON;
- foreign keys, unique constraints, status checks, and time-range checks equivalent to the current schema.

Repository mapping converts PostgreSQL `Date` instances to ISO timestamps and date values to `YYYY-MM-DD` strings at the application boundary, preserving the current API contracts.

### Migrations

`migrate(pool)` is idempotent:

1. Create the validated application schema if absent and select it as the connection search path.
2. Create `schema_migrations` if absent.
3. Apply the complete base PostgreSQL schema as migration 1.
4. Apply the weekly-requirement start field/backfill as migration 2.
5. Record each version only after its SQL succeeds inside a transaction.

The process-global readiness promise prevents duplicate migration attempts inside one server process. SQL uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ADD COLUMN IF NOT EXISTS` so an interrupted startup can safely retry.

Existing members discovered without `weekly_requirement_start` are backfilled to the first Monday after the migration date. New members start on the first Monday on or after creation, preserving the current ledger rules.

## Repository conversion

All database functions become asynchronous and accept a small query-capable PostgreSQL interface or a `Pool`:

- reads use parameterised `$1`, `$2`, ... queries;
- list filters use `= ANY($n::int[])` rather than interpolated IDs;
- inserts use `RETURNING` rather than SQLite `lastInsertRowid`;
- mutations use `rowCount` rather than SQLite `changes`;
- member and calendar multi-write operations acquire a pool client and use `BEGIN`, `COMMIT`, and `ROLLBACK`;
- clients are always released in `finally`.

The following layers become async without changing their JSON shapes:

- repository member/project/venture/calendar functions;
- project-scope and API-policy functions;
- weekly ledger and weekly/monthly report builders;
- all member, admin, report, health, and agent route handlers.

Calendar and report calculations remain application logic. PostgreSQL supplies the same bounded entry sets; interval union, timezone boundaries, carry-forward, redaction, and reminder semantics do not change.

## Data persistence and transition

This release does not attempt to recover already-deleted container-local SQLite data. There is no reliable source left to import.

After deployment:

1. Provision or select a persistent PostgreSQL database.
2. Set `DATABASE_URL` in Coolify.
3. Redeploy the `main` branch.
4. The app creates its schema automatically.
5. An admin recreates any team/project records that were already lost.

The Docker image no longer needs SQLite native build tools or `/app/data` for application persistence. A volume may remain mounted harmlessly, but Team Horizon no longer reads or writes a database file there.

## Development and testing

### Unit and integration tests

- Replace `better-sqlite3` test databases with `pg-mem` pools for the normal fast test suite.
- Keep repository and policy tests exercising real SQL through the same `pg` query interface.
- Preserve existing ledger, project visibility, redaction, report, recurrence, auth, component, and deployment tests.
- Add an editor regression test proving `EntryEditor` renders without a weekly status.
- Add migration tests proving repeated PostgreSQL migration is safe and the weekly field is present.

### Real PostgreSQL end-to-end test

Use the supplied development `DATABASE_URL` only through ignored local environment configuration. The test harness creates a uniquely named schema such as `team_horizon_e2e_<timestamp>`, then passes that name as `DATABASE_SCHEMA`.

The end-to-end test must:

1. Start with an empty isolated schema.
2. Run the application and automatic migrations.
3. Unlock admin with the local test PIN.
4. Create a venture, project, and two members.
5. Recognise one member by email.
6. Verify that only the selected project's members are returned.
7. Click `＋` and verify the editor opens even if weekly-status data is unavailable.
8. Save multiple available ranges and verify the weekly total.
9. Stop and restart the application against the same schema.
10. Verify the created records and availability remain.
11. Drop only the uniquely named test schema in cleanup.

Cleanup validates the schema name before issuing `DROP SCHEMA ... CASCADE`. It must never target `public`, `team_horizon`, or any user-supplied unvalidated identifier.

### Release verification

- complete Vitest suite;
- TypeScript typecheck;
- Next.js production build;
- real PostgreSQL end-to-end flow;
- browser inspection at desktop and mobile widths;
- Git check confirming no `.env.local`, connection string, SQLite file, PostgreSQL dump, or generated credentials are tracked.

## Dependencies and deployment files

- Add runtime dependency `pg`.
- Add development dependencies `@types/pg` and `pg-mem`.
- Remove `better-sqlite3` and `@types/better-sqlite3`.
- Simplify the Docker build image by removing native SQLite compilation packages.
- Update `.env.example` to use a non-secret placeholder `DATABASE_URL` and document optional `DATABASE_SCHEMA`.
- Update README and Coolify instructions so PostgreSQL is the persistence boundary and `/app/data` is no longer required.

## Error handling

- A missing `DATABASE_URL` returns a clear service configuration error on database-backed endpoints and an unhealthy response from `/api/health`.
- Connection or migration failures return bounded messages and never include the connection URL or password.
- Failed transactions roll back before releasing their client.
- Weekly-status fetch failure leaves the calendar usable and produces neutral editor guidance.
- PostgreSQL uniqueness errors retain the existing friendly duplicate-email behavior using SQLSTATE `23505`.
- Project-scope, ownership, range, token, and admin authorization errors retain their current status codes and messages.

## Acceptance criteria

The release is accepted when:

- clicking any owned-row `＋` always opens the entry editor;
- availability can be created and read even when weekly status fails independently;
- all persistence uses PostgreSQL through `DATABASE_URL`;
- a real server restart preserves the E2E-created data;
- project privacy and 40-hour global ledger behavior remain unchanged;
- all automated, build, browser, and repository hygiene checks pass;
- the verified commit is pushed to `main` for Coolify deployment.
