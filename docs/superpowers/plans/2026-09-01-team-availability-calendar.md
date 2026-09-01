# Team Availability Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, Coolify-ready shared availability calendar for Knotie and Hexai with voluntary member entries, leave, project colours, update gaps, common-time discovery, and a read-only agent API.

**Architecture:** A single Next.js 16 application serves the responsive React interface and JSON route handlers. SQLite is accessed only on the server through `better-sqlite3`; migrations and an optional empty-database bootstrap run idempotently. Members identify themselves by a recognised email stored in a signed HTTP-only cookie, while the admin surface uses one configured PIN.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript 7.0.2, SQLite with better-sqlite3 13.0.3, Zod 4.5.4, Vitest 4.1.11, Luxon, Docker.

**Spec:** `docs/superpowers/specs/2026-09-01-team-availability-calendar-design.md`

## Global Constraints

- The product is a voluntary planning calendar, not an attendance, productivity, or activity-tracking system.
- Everyone can view the shared schedule; recognised members can mutate only their own entries.
- Member access uses email recognition without password or email verification in this pilot.
- The admin area uses a single `ADMIN_PIN`; the agent endpoint is disabled unless `AGENT_API_TOKEN` exists.
- UTC is the storage format; `Europe/London` and `Asia/Kolkata` must render correctly across daylight-saving changes.
- `DATABASE_PATH` defaults to `./data/team-calendar.db`; Coolify mounts `/app/data` persistently.
- No external calendar sync, automatic email delivery, task management, timesheets, attendance reporting, or productivity analytics.

---

### Task 1: Runnable application shell and database migration

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
- Create: `.gitignore`, `.dockerignore`, `.env.example`, `Dockerfile`, `README.md`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/db.ts`, `src/lib/schema.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Produces: `getDb(): Database.Database`, `migrate(db): void`, and the complete SQLite schema from the spec.

- [ ] **Step 1: Add the toolchain and a failing migration test**

Create a Vitest test that opens `:memory:`, calls `migrate`, queries `sqlite_master`, and expects `ventures`, `projects`, `members`, `member_ventures`, `member_projects`, `calendar_series`, `calendar_entries`, and `series_exceptions`.

- [ ] **Step 2: Verify the database test fails**

Run `npm test -- src/lib/db.test.ts` and expect failure because `migrate` does not exist.

- [ ] **Step 3: Implement the application shell and idempotent migration**

Create all tables with foreign keys, `NOCASE` unique member email, indexes on member/time and project/time, WAL mode for file databases, and an idempotent `schema_migrations` record. Add scripts for `dev`, `build`, `start`, `test`, and `typecheck`.

- [ ] **Step 4: Verify migration and production compilation**

Run `npm test -- src/lib/db.test.ts` and `npm run build`; expect both to pass.

- [ ] **Step 5: Commit the shell**

Run `git add . && git commit -m "feat: scaffold calendar and sqlite schema"`.

### Task 2: Time, recurrence, and common-slot domain logic

**Files:**
- Create: `src/lib/domain.ts`, `src/lib/time.ts`, `src/lib/recurrence.ts`, `src/lib/common-time.ts`
- Test: `src/lib/recurrence.test.ts`, `src/lib/common-time.test.ts`

**Interfaces:**
- Produces: `CalendarStatus`, `CalendarEntry`, `expandRecurrence(input): OccurrenceInput[]`, and `findCommonSlots(input): CommonSlot[]`.
- `expandRecurrence` accepts local date/time, IANA zone, recurrence weekdays, and inclusive end date; it returns UTC occurrences while retaining the original local date.
- `findCommonSlots` accepts member IDs, declared entries, range, and minimum minutes; it returns intersections after subtracting busy and leave.

- [ ] **Step 1: Write failing daylight-saving and split-window tests**

Test that a 09:00 London weekly entry retains 09:00 local time across the October clock change, and that two members with split availability receive only the true intersections after a leave block is removed.

- [ ] **Step 2: Verify the domain tests fail**

Run `npm test -- src/lib/recurrence.test.ts src/lib/common-time.test.ts`; expect missing-module failures.

- [ ] **Step 3: Implement minimal pure domain functions**

Use Luxon for zone-aware local-to-UTC conversion. Merge overlapping availability per member, subtract that member's `busy` and `leave`, intersect all selected members, split results at local day boundaries, discard slots shorter than the requested minimum, and mark a slot tentative if any contributing availability is tentative.

- [ ] **Step 4: Verify the domain tests pass**

Run `npm test -- src/lib/recurrence.test.ts src/lib/common-time.test.ts`; expect all tests to pass.

- [ ] **Step 5: Commit domain behaviour**

Run `git add src/lib && git commit -m "feat: add timezone recurrence and common-time logic"`.

### Task 3: Member recognition, admin PIN, and ownership helpers

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/validation.ts`
- Create: `src/app/api/session/route.ts`, `src/app/api/admin/session/route.ts`
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Produces: `signSession(memberId): string`, `readMemberSession(cookie): number | null`, `signAdminSession(): string`, `isAdminSession(cookie): boolean`, `requireMember()`, and `requireAdmin()`.
- Session POST consumes `{ email: string }`; admin POST consumes `{ pin: string }`.

- [ ] **Step 1: Write failing signed-cookie tests**

Test valid member round-trip, tamper rejection, expiry rejection, valid admin PIN, and incorrect admin PIN.

- [ ] **Step 2: Verify authentication tests fail**

Run `npm test -- src/lib/auth.test.ts`; expect missing exports.

- [ ] **Step 3: Implement signed sessions and routes**

Sign compact payloads with HMAC-SHA256 using `SESSION_SECRET`, falling back to `ADMIN_PIN` in development. Set `HttpOnly`, `SameSite=Lax`, `Secure` in production, and 30-day member/12-hour admin expiries. Return neutral unknown-email errors.

- [ ] **Step 4: Verify authentication tests pass**

Run `npm test -- src/lib/auth.test.ts`; expect all tests to pass.

- [ ] **Step 5: Commit access control**

Run `git add src && git commit -m "feat: add trusted member and admin access"`.

### Task 4: Reference-data and entry APIs

**Files:**
- Create: `src/lib/repository.ts`
- Create: `src/app/api/bootstrap/route.ts`
- Create: `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`
- Create: `src/app/api/ventures/route.ts`, `src/app/api/ventures/[id]/route.ts`
- Create: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`
- Create: `src/app/api/entries/route.ts`, `src/app/api/entries/[id]/route.ts`
- Test: `src/lib/repository.test.ts`

**Interfaces:**
- Produces repository functions `listBootstrap`, `createMember`, `updateMember`, `createVenture`, `createProject`, `listEntries`, `createEntries`, `updateOwnedEntry`, and `deleteOwnedEntry`.
- Entry creation consumes one local block plus optional recurrence and writes a series with materialised occurrences through its end date.

- [ ] **Step 1: Write failing repository tests**

Test case-insensitive member lookup, multi-block entry creation, recurring materialisation, one-member ownership enforcement, reference archiving, and a maximum 366-day entry query.

- [ ] **Step 2: Verify repository tests fail**

Run `npm test -- src/lib/repository.test.ts`; expect missing repository exports.

- [ ] **Step 3: Implement validated repositories and handlers**

Use Zod schemas with field-specific messages, transactions for series creation, and server-side member ID from the signed cookie rather than request data. Permit overlapping entries and flag overlaps in responses.

- [ ] **Step 4: Verify repository tests and types**

Run `npm test -- src/lib/repository.test.ts && npm run typecheck`; expect both to pass.

- [ ] **Step 5: Commit calendar APIs**

Run `git add src && git commit -m "feat: add members projects and calendar entry APIs"`.

### Task 5: Dashboard, completeness, common-time, health, and agent APIs

**Files:**
- Create: `src/lib/dashboard.ts`
- Create: `src/app/api/dashboard/route.ts`, `src/app/api/common-time/route.ts`
- Create: `src/app/api/agent/availability/route.ts`, `src/app/api/health/route.ts`
- Test: `src/lib/dashboard.test.ts`, `src/app/api/agent/availability/route.test.ts`

**Interfaces:**
- Produces: `buildDashboard({ now, zone, members, entries }): DashboardSummary`.
- Dashboard output contains `availableNow`, `onLeaveToday`, `nextAvailable`, `needsUpdate`, and `horizon`.
- Agent GET accepts ISO `from` and `to`, optional repeated `member`, `project`, and `status`, and returns UTC records plus source time zones.

- [ ] **Step 1: Write failing dashboard and agent-policy tests**

Test that “needs update” means no availability or leave in the next seven local dates, archived members are excluded, and the agent endpoint is unavailable without a configured token and rejects an incorrect bearer token.

- [ ] **Step 2: Verify tests fail**

Run `npm test -- src/lib/dashboard.test.ts src/app/api/agent/availability/route.test.ts`; expect failures.

- [ ] **Step 3: Implement calculations and read-only routes**

Calculate dashboard state from declarations only, expose no attendance-derived values, cap common-time ranges at 31 days, cap agent ranges at 366 days, and make health query `SELECT 1`.

- [ ] **Step 4: Verify feature tests pass**

Run `npm test -- src/lib/dashboard.test.ts src/app/api/agent/availability/route.test.ts`; expect all tests to pass.

- [ ] **Step 5: Commit planning APIs**

Run `git add src && git commit -m "feat: add dashboard common-time and agent availability"`.

### Task 6: Shared dashboard and weekly calendar interface

**Files:**
- Modify: `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/components/CalendarApp.tsx`, `src/components/EmailGate.tsx`, `src/components/TeamHorizon.tsx`, `src/components/SummaryCards.tsx`, `src/components/WeekCalendar.tsx`, `src/components/EntryEditor.tsx`, `src/components/CommonTime.tsx`, `src/components/ui.tsx`
- Test: `src/components/calendar-view.test.tsx`

**Interfaces:**
- Consumes all public APIs from Tasks 3–5.
- Produces a responsive, accessible member experience with URL-independent client state.

- [ ] **Step 1: Write failing interface tests**

Test that the email gate labels the pilot access clearly, the dashboard has “Available now”, “On leave”, “Needs an update”, and “Find common time”, and an entry form permits two split ranges on one date.

- [ ] **Step 2: Verify interface tests fail**

Run `npm test -- src/components/calendar-view.test.tsx`; expect missing components.

- [ ] **Step 3: Implement the member interface**

Use the approved midnight/sky/mist/coral/leaf palette, Fraunces/Inter/IBM Plex Mono typography, the 24-hour team horizon, calm status copy, sticky calendar labels, keyboard-visible controls, accessible dialogs, mobile bottom-sheet editing, and reduced-motion support. Add filters for venture, project, person, location, status, and display zone.

- [ ] **Step 4: Verify interface, types, and production build**

Run `npm test -- src/components/calendar-view.test.tsx && npm run typecheck && npm run build`; expect all to pass.

- [ ] **Step 5: Commit member experience**

Run `git add src && git commit -m "feat: build shared availability dashboard"`.

### Task 7: Lightweight admin interface

**Files:**
- Create: `src/app/admin/page.tsx`, `src/components/AdminApp.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/admin-view.test.tsx`

**Interfaces:**
- Consumes admin session and reference-data mutation APIs.
- Produces PIN entry plus member, venture, and project add/edit/archive forms.

- [ ] **Step 1: Write failing admin view tests**

Test PIN prompt, member fields for name/email/location/time zone/venture/projects, project colour selection, and archive language.

- [ ] **Step 2: Verify admin view tests fail**

Run `npm test -- src/components/admin-view.test.tsx`; expect missing component failure.

- [ ] **Step 3: Implement compact admin workflows**

Keep the admin screen operational rather than dashboard-like. Provide default London and Kolkata zones, validate duplicate email visibly, and use archive rather than destructive deletion.

- [ ] **Step 4: Verify admin tests and full suite**

Run `npm test && npm run typecheck`; expect all tests to pass.

- [ ] **Step 5: Commit administration**

Run `git add src && git commit -m "feat: add lightweight team administration"`.

### Task 8: Coolify packaging and release verification

**Files:**
- Modify: `Dockerfile`, `.dockerignore`, `.env.example`, `README.md`, `next.config.ts`
- Create: `scripts/docker-smoke.sh`

**Interfaces:**
- Produces a standalone Node container listening on `PORT`, a persistent `/app/data` location, and `/api/health` returning HTTP 200 when SQLite is writable.

- [ ] **Step 1: Add a failing container smoke script**

The script builds the image, runs it with a temporary named volume and non-default PIN/token, waits for `/api/health`, asserts `{"ok":true}`, restarts the container with the same volume, reasserts health, and removes only its explicitly named test resources.

- [ ] **Step 2: Run the smoke script and observe the initial packaging failure**

Run `bash scripts/docker-smoke.sh`; expect failure until the standalone image and runtime data directory are complete.

- [ ] **Step 3: Complete Docker and deployment documentation**

Use a multi-stage Node 22 Alpine build with native build prerequisites only in the build stage, copy Next standalone output, create `/app/data`, run as the unprivileged `nextjs` user, document Coolify port `3000`, persistent mount `/app/data`, `ADMIN_PIN`, `SESSION_SECRET`, optional `AGENT_API_TOKEN`, and health path `/api/health`.

- [ ] **Step 4: Run final verification**

Run `npm test && npm run typecheck && npm run build && bash scripts/docker-smoke.sh && git diff --check`; expect every command to pass.

- [ ] **Step 5: Commit the release**

Run `git add . && git commit -m "chore: package team calendar for Coolify"`.

