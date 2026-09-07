# PostgreSQL Migration and Entry Editor Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all SQLite persistence with PostgreSQL through `DATABASE_URL`, preserve data across Coolify redeployments, and make the availability editor open even when weekly-status data is unavailable.

**Architecture:** Use one lazily initialized `pg.Pool`, a validated application schema, and idempotent PostgreSQL migrations. Convert repository, policy, ledger, report, and route boundaries to async while keeping existing JSON contracts. Use `pg-mem` for fast SQL-backed tests and a uniquely named schema on the supplied development PostgreSQL server for restart-persistence and browser E2E verification.

**Tech Stack:** Next.js 16, React 19, TypeScript 7, PostgreSQL, `pg`, `pg-mem`, Luxon, Zod, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-postgresql-migration-editor-fix-design.md`

## Global Constraints

- PostgreSQL is the only runtime database; `DATABASE_URL` is required for persistence-backed requests.
- `DATABASE_SCHEMA` defaults to `team_horizon` and must match `^[a-z_][a-z0-9_]*$`.
- Never log, commit, or return a database connection string or password.
- Keep current API payloads, project privacy, redaction, and global 40-hour ledger behavior unchanged.
- A weekly-status failure must never block creating, editing, or deleting availability.
- Real-database tests may create and drop only a generated `team_horizon_e2e_<timestamp>` schema, never `public` or `team_horizon`.
- No SQLite file, PostgreSQL dump, `.env.local`, or generated test credential may be committed.

---

### Task 1: PostgreSQL Connection and Idempotent Schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Replace: `src/lib/schema.ts`
- Replace: `src/lib/db.ts`
- Create: `src/lib/test-db.ts`
- Replace: `src/lib/db.test.ts`

**Interfaces:**
- Produces: `DbPool`, `DbQueryable`, `databaseSchema()`, `migrate(pool)`, async `getDb()`, and `createTestDb()`.
- Consumes: `DATABASE_URL`, optional `DATABASE_SCHEMA`, `pg.Pool`, and `pg-mem`.

- [ ] **Step 1: Install PostgreSQL dependencies and remove SQLite dependencies**

Run: `npm install pg && npm install -D @types/pg pg-mem && npm uninstall better-sqlite3 @types/better-sqlite3`

Expected: lockfile contains `pg` and `pg-mem`; no `better-sqlite3` package remains.

- [ ] **Step 2: Write failing database tests**

```ts
const db = await createTestDb();
await migrate(db);
await migrate(db);
const versions = await db.query<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version");
expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);
const columns = await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='members'");
expect(columns.rows.map((row) => row.column_name)).toContain("weekly_requirement_start");
expect(() => databaseSchema("public-invalid!")).toThrow("DATABASE_SCHEMA");
```

- [ ] **Step 3: Run the database test and verify SQLite-only code fails**

Run: `npm test -- src/lib/db.test.ts`
Expected: FAIL because the PostgreSQL helpers and schema do not exist.

- [ ] **Step 4: Implement PostgreSQL schema, pool readiness, and test pool**

`POSTGRES_SCHEMA_SQL` creates all nine tables with identity IDs, booleans, `TIMESTAMPTZ`, `DATE`, constraints, and indexes. `getDb()` requires `DATABASE_URL`, constructs `new Pool({ connectionString, options: '-c search_path=<schema>' })`, calls `CREATE SCHEMA IF NOT EXISTS "<validated>"`, awaits one shared migration promise, and returns the ready pool. `createTestDb()` uses `newDb().adapters.createPg().Pool` and runs the same migrations.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/lib/db.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/schema.ts src/lib/db.ts src/lib/test-db.ts src/lib/db.test.ts
git commit -m "feat: add PostgreSQL connection and migrations"
```

### Task 2: Async PostgreSQL Repository

**Files:**
- Replace: `src/lib/repository.ts`
- Replace: `src/lib/repository.test.ts`

**Interfaces:**
- Produces async versions of `createVenture`, `createProject`, `createMember`, `updateMember`, `findMemberByEmail`, `findMemberById`, `listBootstrap`, `listEntries`, `createEntries`, `updateOwnedEntry`, `deleteOwnedEntry`, and `archiveReference`.
- Consumes: `DbPool`, PostgreSQL `$n` parameters, `RETURNING`, `rowCount`, and explicit client transactions.

- [ ] **Step 1: Convert repository tests to awaited PostgreSQL behavior**

```ts
db = await createTestDb();
const venture = await createVenture(db, { name: "Knotie", colour: "#466CFF" });
const member = await findMemberByEmail(db, "  asha@EXAMPLE.com ");
expect(member?.id).toBe(memberId);
expect(await deleteOwnedEntry(db, memberId + 1, entry.id)).toBe(false);
```

Add assertions for `23505` duplicate email, transaction rollback when an association is invalid, ISO timestamp mapping, ownership, recurrence, and archive behavior.

- [ ] **Step 2: Run repository tests and verify synchronous SQLite calls fail**

Run: `npm test -- src/lib/repository.test.ts`
Expected: FAIL on the old synchronous implementation.

- [ ] **Step 3: Implement the async PostgreSQL repository**

Use `SELECT ... WHERE id = ANY($3::int[])`, `INSERT ... RETURNING id`, and a reusable `withTransaction(pool, work)` that rolls back and releases in `finally`. Map `Date` values with `toISOString()` and booleans directly.

- [ ] **Step 4: Run database and repository tests**

Run: `npm test -- src/lib/db.test.ts src/lib/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repository.ts src/lib/repository.test.ts
git commit -m "feat: move calendar repository to PostgreSQL"
```

### Task 3: Async Scope, Ledger, and Reports

**Files:**
- Modify: `src/lib/project-scope.ts`
- Modify: `src/lib/project-scope.test.ts`
- Modify: `src/lib/api-policy.ts`
- Modify: `src/lib/api-policy.test.ts`
- Modify: `src/lib/weekly-ledger.ts`
- Modify: `src/lib/weekly-ledger.test.ts`
- Modify: `src/lib/reports.ts`
- Modify: `src/lib/reports.test.ts`

**Interfaces:**
- Produces awaited project-scope, API-policy, weekly ledger, and weekly/monthly report functions with unchanged return types.
- Consumes: async repository methods and `DbPool`.

- [ ] **Step 1: Convert service tests to async PostgreSQL fixtures**

```ts
const scope = await resolveMemberProject(db, viewerId, projectId);
await expect(resolveMemberProject(db, viewerId, unrelatedProjectId)).rejects.toThrow("Project access is not available");
const status = await weeklyStatusForMember(db, member, "2026-03-23");
expect(status.remainingHours).toBe(10);
const report = await buildMonthlyReport(db, projectId, "2026-09");
expect(report.weeks).toHaveLength(4);
```

- [ ] **Step 2: Run service tests and verify unawaited repository dependencies fail**

Run: `npm test -- src/lib/project-scope.test.ts src/lib/api-policy.test.ts src/lib/weekly-ledger.test.ts src/lib/reports.test.ts`
Expected: FAIL until the service graph is async.

- [ ] **Step 3: Propagate async behavior through the service graph**

Await every repository call. Keep entry redaction, audience intersection, weekly interval union, carry-forward, report aggregation, and error messages byte-for-byte compatible where observable.

- [ ] **Step 4: Run all service tests**

Run: `npm test -- src/lib/project-scope.test.ts src/lib/api-policy.test.ts src/lib/weekly-ledger.test.ts src/lib/reports.test.ts src/lib/dashboard.test.ts src/lib/common-time.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-scope.ts src/lib/project-scope.test.ts src/lib/api-policy.ts src/lib/api-policy.test.ts src/lib/weekly-ledger.ts src/lib/weekly-ledger.test.ts src/lib/reports.ts src/lib/reports.test.ts
git commit -m "refactor: make availability services asynchronous"
```

### Task 4: Async API Routes and Health Check

**Files:**
- Modify: every `src/app/api/**/route.ts` that calls `getDb()` or a database service
- Create: `src/lib/database-errors.ts`
- Create: `src/lib/database-errors.test.ts`

**Interfaces:**
- Produces awaited database acquisition in all routes, PostgreSQL duplicate detection, and `/api/health` database readiness.
- Consumes: async services from Tasks 1–3.

- [ ] **Step 1: Write failing safe-error tests**

```ts
expect(isUniqueViolation({ code: "23505" })).toBe(true);
expect(publicDatabaseError(new Error("connect ECONNREFUSED password=secret"))).toBe("Database service is unavailable");
```

- [ ] **Step 2: Run the error test and verify helpers are missing**

Run: `npm test -- src/lib/database-errors.test.ts`
Expected: FAIL because the PostgreSQL error helpers do not exist.

- [ ] **Step 3: Implement safe errors and await all route database work**

Every handler uses `const db = await getDb()`. Health runs `await db.query("SELECT 1")`. Member creation maps SQLSTATE `23505` to the existing duplicate-email text. No caught database error serializes `message`, `detail`, `connection`, or stack data to clients.

- [ ] **Step 4: Run typecheck and the full unit suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/lib/database-errors.ts src/lib/database-errors.test.ts
git commit -m "refactor: connect API routes to PostgreSQL"
```

### Task 5: Entry Editor Opens Without Weekly Status

**Files:**
- Modify: `src/components/EntryEditor.tsx`
- Modify: `src/components/CalendarApp.tsx`
- Modify: `src/components/calendar-view.test.tsx`

**Interfaces:**
- Produces: optional `weeklyStatus?: WeeklyStatus | null` editor prop and editor rendering controlled only by `editorDate`.
- Consumes: existing weekly preview when status exists.

- [ ] **Step 1: Write the failing regression test**

```tsx
render(<EntryEditor date="2026-09-07" projects={[]} timezone="Europe/London" weeklyStatus={null} onClose={vi.fn()} onSaved={vi.fn()} />);
expect(screen.getByRole("dialog")).toBeInTheDocument();
expect(screen.getByText(/weekly total will refresh after saving/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run component tests and verify null status crashes or blocks typing**

Run: `npm test -- src/components/calendar-view.test.tsx`
Expected: FAIL because `weeklyStatus.remainingHours` is unconditional.

- [ ] **Step 3: Decouple editor rendering and add fallback guidance**

Change the CalendarApp condition from `editorDate && weeklyStatus` to `editorDate`. Compute the preview only when a status exists; otherwise render neutral fallback copy. Saving continues to refresh entries and weekly status independently.

- [ ] **Step 4: Run component tests and typecheck**

Run: `npm test -- src/components/calendar-view.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/EntryEditor.tsx src/components/CalendarApp.tsx src/components/calendar-view.test.tsx
git commit -m "fix: open availability editor without weekly status"
```

### Task 6: PostgreSQL Deployment Contract

**Files:**
- Modify: `Dockerfile`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `src/lib/deployment-config.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Coolify documentation requiring only `DATABASE_URL` for database persistence and a Docker image without SQLite build tooling.
- Consumes: runtime contract from Task 1.

- [ ] **Step 1: Write failing deployment configuration assertions**

```ts
expect(dockerfile).not.toContain("python3 make g++");
expect(envExample).toContain("DATABASE_URL=postgresql://");
expect(readme).not.toContain("mount a volume at `/app/data`");
```

- [ ] **Step 2: Run the deployment test and verify SQLite instructions fail**

Run: `npm test -- src/lib/deployment-config.test.ts`
Expected: FAIL on current Dockerfile and environment documentation.

- [ ] **Step 3: Update Docker and operator documentation**

Remove native SQLite packages and `DATABASE_PATH`. Add non-secret PostgreSQL placeholders, document automatic `team_horizon` schema creation, Coolify `DATABASE_URL`, optional test-only schema override, PostgreSQL backup ownership, and the fact that already-deleted SQLite rows cannot be recovered.

- [ ] **Step 4: Run deployment tests and production build**

Run: `npm test -- src/lib/deployment-config.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .env.example README.md src/lib/deployment-config.test.ts .gitignore
git commit -m "docs: deploy Team Horizon with PostgreSQL"
```

### Task 7: Real PostgreSQL E2E and Release

**Files:**
- Create: `scripts/postgres-e2e.mjs`
- Modify: `package.json`
- Local-only: `.env.local`

**Interfaces:**
- Produces: `npm run test:e2e:postgres`, a generated isolated schema, persistence restart proof, and verified `main` deployment.
- Consumes: supplied development `DATABASE_URL`, local test PIN/secret/token, built Next standalone server, and browser automation.

- [ ] **Step 1: Add the isolated-schema E2E harness**

The script validates a generated `team_horizon_e2e_<digits>` name, creates only that schema, spawns the built app with `DATABASE_SCHEMA`, performs admin/member/project/entry/status HTTP flows with a cookie jar, stops and restarts the app against the same schema, verifies records persist, and drops only the generated schema in `finally`.

- [ ] **Step 2: Run full local verification**

Run: `npm test && npm run typecheck && npm run build && npm run test:e2e:postgres && git diff --check`
Expected: all unit tests pass, typecheck/build exit zero, real PostgreSQL flow survives restart, and diff check is empty.

- [ ] **Step 3: Verify the actual ＋ interaction in a browser**

Start the app against another generated development schema, create fixtures through the admin/member APIs, open the calendar at desktop and mobile widths, click an owned-row `＋`, verify the dialog and fallback status copy, save split availability, reload, and confirm it remains visible.

- [ ] **Step 4: Confirm repository hygiene**

Run: `git status --short && git grep -n 'postgres://' -- ':!README.md' ':!.env.example' || true && git ls-files | rg '(\.db($|-)|\.db-(shm|wal)$|\.env\.local$|\.sql$)' || true`
Expected: no connection credential, database file, dump, or local environment file is tracked.

- [ ] **Step 5: Commit the E2E harness**

```bash
git add scripts/postgres-e2e.mjs package.json package-lock.json
git commit -m "test: verify PostgreSQL persistence end to end"
```

- [ ] **Step 6: Rebase and push verified work**

```bash
git fetch origin main
git rebase origin/main
npm test && npm run typecheck && npm run build && npm run test:e2e:postgres
git push origin HEAD:main
```

Expected: remote `main` resolves to the verified local commit and triggers Coolify deployment.
