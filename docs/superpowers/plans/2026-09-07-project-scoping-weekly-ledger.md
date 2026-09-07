# Project Scoping and Weekly Availability Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict each member's calendar to one assigned project at a time and add a global, carry-forward 40-hour Monday-to-Sunday availability ledger with reminder-ready agent data and admin reports.

**Architecture:** Keep SQLite calendar entries as the source of truth. Add server-side project-scope helpers that shape every member and agent response, and add a pure ledger module that unions `available` intervals in each member's timezone and derives carry sequentially. Preserve the existing member layout, adding only a required project switcher and compact progress copy; place reporting in the existing admin page.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 7, better-sqlite3, Luxon, Zod, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-07-project-scoping-weekly-ledger-design.md`

## Global Constraints

- One 40-hour requirement per member across all projects, Monday through Sunday in that member's IANA timezone.
- Only `available` entries count; overlaps count once and DST/week boundaries must be correct.
- Deficits carry forward; surplus can clear debt but cannot reduce a later target below 40 hours.
- Ordinary members must never receive unrelated members or an all-project calendar response.
- Cross-project details are redacted server-side as `Busy on another project`, except for the entry owner.
- Keep the existing email gate, calendar grid, entry editor, copy tone, and primary workflow recognisable.
- Agent availability and reports require bearer authentication and an explicit `projectId`.
- Do not commit the development SQLite database or secrets.

---

### Task 1: Requirement Start Migration and Domain Types

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/domain.ts`
- Modify: `src/lib/repository.ts`
- Test: `src/lib/db.test.ts`
- Test: `src/lib/repository.test.ts`

**Interfaces:**
- Produces: `Member.weeklyRequirementStart: string`; `firstMondayOnOrAfter(localDate: string): string`; schema migration version 2.
- Consumes: existing `migrate`, `createMember`, and member mapping paths.

- [ ] **Step 1: Write failing migration and creation tests**

```ts
expect(columns).toContain("weekly_requirement_start");
expect(versions).toEqual([1, 2]);
expect(created.weeklyRequirementStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
expect(DateTime.fromISO(created.weeklyRequirementStart).weekday).toBe(1);
```

- [ ] **Step 2: Run the focused tests and verify the new field is absent**

Run: `npm test -- src/lib/db.test.ts src/lib/repository.test.ts`
Expected: FAIL because migration version 2 and `weeklyRequirementStart` do not exist.

- [ ] **Step 3: Add the idempotent version-2 migration and member field**

```ts
export interface Member {
  // existing fields
  weeklyRequirementStart: string;
}

export function firstMondayOnOrAfter(localDate: string): string {
  const day = DateTime.fromISO(localDate, { zone: "utc" }).startOf("day");
  return day.plus({ days: (8 - day.weekday) % 7 }).toISODate()!;
}
```

`migrate()` must inspect `schema_migrations`, add the nullable column once, backfill existing members to the next Monday after the migration date, and then make repository mapping fail clearly if the value is missing. `createMember()` must insert the first Monday on or after today's local date.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/db.test.ts src/lib/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts src/lib/db.ts src/lib/domain.ts src/lib/repository.ts src/lib/db.test.ts src/lib/repository.test.ts
git commit -m "feat: add weekly requirement start migration"
```

### Task 2: Pure Weekly Ledger

**Files:**
- Create: `src/lib/weekly-ledger.ts`
- Create: `src/lib/weekly-ledger.test.ts`

**Interfaces:**
- Produces: `BASE_WEEKLY_TARGET_MINUTES = 2400`; `WeeklyStatus`; `weeklyStatusForMember(db, member, weekDate, nowUtc?)`; `weeklyStatusesForMembers(db, members, weekDate, nowUtc?)`.
- Consumes: `Member`, `DisplayEntry`, Luxon, and repository range queries.

- [ ] **Step 1: Write failing ledger tests for counting and carry**

```ts
expect(status.availableHours).toBe(40);
expect(status.remainingHours).toBe(0);
expect(status.complete).toBe(true);

expect(weekTwo).toMatchObject({ carryInHours: 10, targetHours: 50, availableHours: 45, remainingHours: 5 });
expect(weekThree).toMatchObject({ carryInHours: 5, targetHours: 45, availableHours: 50, remainingHours: 0 });
expect(weekFour.targetHours).toBe(40);
```

Add fixtures proving overlapping/touching intervals count once, tentative/busy/leave count zero, cross-midnight intervals are clamped, Europe/London DST weeks use local Monday boundaries, pre-start weeks return zero target, and reminder state flips after Monday 09:00 local.

- [ ] **Step 2: Run the ledger tests and verify imports fail**

Run: `npm test -- src/lib/weekly-ledger.test.ts`
Expected: FAIL because `weekly-ledger.ts` does not exist.

- [ ] **Step 3: Implement interval union and sequential deficit derivation**

```ts
export interface WeeklyStatus {
  memberId: number;
  memberName: string;
  email: string;
  timezone: string;
  weekStart: string;
  weekEnd: string;
  baseTargetHours: number;
  carryInHours: number;
  targetHours: number;
  availableHours: number;
  remainingHours: number;
  complete: boolean;
  submissionDueAt: string;
  reminderNeeded: boolean;
}
```

Use integer epoch minutes internally, clamp each interval to the member-local week converted to UTC, sort and union intervals, and walk every week from `weeklyRequirementStart` through the requested week. Round only serialized hour values to two decimal places.

- [ ] **Step 4: Run the ledger and repository tests**

Run: `npm test -- src/lib/weekly-ledger.test.ts src/lib/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekly-ledger.ts src/lib/weekly-ledger.test.ts
git commit -m "feat: calculate weekly availability balances"
```

### Task 3: Project Scope and Redaction Services

**Files:**
- Create: `src/lib/project-scope.ts`
- Create: `src/lib/project-scope.test.ts`
- Modify: `src/lib/repository.ts`

**Interfaces:**
- Produces: `resolveMemberProject(db, memberId, requestedProjectId?)`; `projectAudience(db, projectId)`; `scopedEntries(db, projectId, viewerMemberId, fromUtc, toUtc, memberIds?)`; `assertMemberCanUseProject(db, memberId, projectId)`.
- Consumes: existing member/project assignment tables and `listEntries`.

- [ ] **Step 1: Write failing visibility tests**

```ts
expect(scope.selectableProjects.map((p) => p.id)).toEqual([sharedProjectId]);
expect(scope.members.map((m) => m.id)).toEqual([viewerId, colleagueId]);
expect(() => resolveMemberProject(db, viewerId, unrelatedProjectId)).toThrow("Project access is not available");
expect(redacted[0]).toMatchObject({ projectId: null, projectName: "Busy on another project", note: null });
expect(ownerView[0].note).toBe("Private project detail");
```

- [ ] **Step 2: Run focused tests and verify helpers are missing**

Run: `npm test -- src/lib/project-scope.test.ts`
Expected: FAIL because `project-scope.ts` does not exist.

- [ ] **Step 3: Implement SQL-backed project access and response shaping**

`resolveMemberProject` must select the requested active assigned project or the first active assignment. `projectAudience` must return only active assigned members plus the selected venture/project metadata. `scopedEntries` must query only audience member IDs and redact any entry whose `projectId` differs from the selected project unless `entry.memberId === viewerMemberId`.

- [ ] **Step 4: Run project-scope and repository tests**

Run: `npm test -- src/lib/project-scope.test.ts src/lib/repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-scope.ts src/lib/project-scope.test.ts src/lib/repository.ts
git commit -m "feat: enforce project scoped calendar visibility"
```

### Task 4: Member API Enforcement and Weekly Status Endpoint

**Files:**
- Modify: `src/app/api/bootstrap/route.ts`
- Modify: `src/app/api/entries/route.ts`
- Modify: `src/app/api/entries/[id]/route.ts`
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/api/common-time/route.ts`
- Create: `src/app/api/weekly-status/route.ts`
- Create: `src/lib/api-policy.ts`
- Create: `src/lib/api-policy.test.ts`

**Interfaces:**
- Produces: member-safe response builders used by App Router handlers; `GET /api/weekly-status?week=YYYY-MM-DD`.
- Consumes: project scope helpers, dashboard/common-time functions, weekly ledger functions, existing cookie access.

- [ ] **Step 1: Write failing policy tests**

```ts
expect(buildMemberBootstrap(db, viewerId, projectId).members.map((m) => m.id)).toEqual([viewerId, colleagueId]);
expect(() => buildMemberBootstrap(db, viewerId, unrelatedProjectId)).toThrow("Project access is not available");
expect(() => assertWritableProject(db, viewerId, unrelatedProjectId)).toThrow("Project access is not available");
```

- [ ] **Step 2: Run the focused test and verify policy helpers are missing**

Run: `npm test -- src/lib/api-policy.test.ts`
Expected: FAIL because `api-policy.ts` does not exist.

- [ ] **Step 3: Implement and wire member endpoint policy**

Bootstrap accepts optional `projectId`, defaults to the first assignment, and returns `selectedProject`, `selectableProjects`, scoped `members/projects/ventures`, `sessionMember`, and `admin`. Entries/dashboard/common-time require a valid selected project for ordinary member requests. POST/PATCH entry project IDs must be null or assigned to the owner. `/api/weekly-status` returns only the current member's global status.

- [ ] **Step 4: Run policy, dashboard, common-time, and component tests**

Run: `npm test -- src/lib/api-policy.test.ts src/lib/dashboard.test.ts src/lib/common-time.test.ts src/components/calendar-view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bootstrap/route.ts src/app/api/entries/route.ts 'src/app/api/entries/[id]/route.ts' src/app/api/dashboard/route.ts src/app/api/common-time/route.ts src/app/api/weekly-status/route.ts src/lib/api-policy.ts src/lib/api-policy.test.ts
git commit -m "feat: scope member APIs by project"
```

### Task 5: Agent Availability and Report APIs

**Files:**
- Create: `src/lib/agent-auth.ts`
- Create: `src/lib/reports.ts`
- Create: `src/lib/reports.test.ts`
- Modify: `src/app/api/agent/availability/route.ts`
- Create: `src/app/api/agent/reports/weekly/route.ts`
- Create: `src/app/api/agent/reports/monthly/route.ts`

**Interfaces:**
- Produces: `requireAgentToken(request)`; `buildWeeklyReport(db, projectId, week, nowUtc?)`; `buildMonthlyReport(db, projectId, month, nowUtc?)`; three bearer-protected JSON routes.
- Consumes: project audience/redaction and weekly ledger services.

- [ ] **Step 1: Write failing report aggregation tests**

```ts
expect(weekly.members[0]).toMatchObject({ targetHours: 50, availableHours: 40, remainingHours: 10 });
expect(monthly.members[0]).toMatchObject({ totalBaseTargetHours: 160, openingCarryHours: 10, closingDeficitHours: 5, completedWeeks: 3 });
expect(monthly.weeks).toHaveLength(4);
```

- [ ] **Step 2: Run focused tests and verify reports are missing**

Run: `npm test -- src/lib/reports.test.ts`
Expected: FAIL because report builders do not exist.

- [ ] **Step 3: Implement reports and agent handlers**

Require `projectId` on every agent route. Availability keeps bounded `from`/`to`, returns selected project members and redacted entries, and includes `weeklyStatus` for `week` or the current week. Weekly/monthly routes return project metadata, global per-member ledger values, generation time, and definitions explaining that only available hours count.

- [ ] **Step 4: Run ledger, scope, and report tests**

Run: `npm test -- src/lib/weekly-ledger.test.ts src/lib/project-scope.test.ts src/lib/reports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-auth.ts src/lib/reports.ts src/lib/reports.test.ts src/app/api/agent/availability/route.ts src/app/api/agent/reports/weekly/route.ts src/app/api/agent/reports/monthly/route.ts
git commit -m "feat: expose reminder and report agent APIs"
```

### Task 6: Minimal Member UI Changes

**Files:**
- Modify: `src/components/CalendarApp.tsx`
- Modify: `src/components/CommonTime.tsx`
- Modify: `src/components/EntryEditor.tsx`
- Create: `src/components/WeeklyProgress.tsx`
- Modify: `src/components/calendar-view.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: required project switcher, `WeeklyProgress`, remaining-hours preview, project-scoped API calls.
- Consumes: scoped bootstrap payload and `WeeklyStatus` from Task 2.

- [ ] **Step 1: Write failing UI tests for compact progress and editor guidance**

```tsx
render(<WeeklyProgress status={{ ...status, targetHours: 46, availableHours: 32, remainingHours: 14, carryInHours: 6 }} />);
expect(screen.getByText(/32 of 46 hours added/i)).toBeInTheDocument();
expect(screen.getByText(/includes 6 carried over/i)).toBeInTheDocument();

render(<EntryEditor {...props} weeklyStatus={status} />);
expect(screen.getByText(/does not count toward weekly available hours/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run component tests and verify the progress component/props are missing**

Run: `npm test -- src/components/calendar-view.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Wire selected project and progress into the existing interface**

Keep all major sections and control positions. Replace the optional `All projects` filter with assigned-project options only. Refetch bootstrap, entries, dashboard, common-time, and weekly status using `projectId`; reset person/location filters after a switch. Add a compact progress pill next to week navigation and editor copy that previews the sum of valid available ranges without presenting it as attendance.

- [ ] **Step 4: Run component tests and typecheck**

Run: `npm test -- src/components/calendar-view.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CalendarApp.tsx src/components/CommonTime.tsx src/components/EntryEditor.tsx src/components/WeeklyProgress.tsx src/components/calendar-view.test.tsx src/app/globals.css
git commit -m "feat: show project scope and weekly progress"
```

### Task 7: Admin Reports and CSV

**Files:**
- Modify: `src/components/AdminApp.tsx`
- Modify: `src/components/admin-view.test.tsx`
- Create: `src/app/api/reports/weekly/route.ts`
- Create: `src/app/api/reports/monthly/route.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: admin-only weekly/monthly report routes, project/week/month controls, status table, browser-generated CSV download.
- Consumes: `buildWeeklyReport`, `buildMonthlyReport`, and existing admin-cookie access.

- [ ] **Step 1: Write failing admin report UI test**

```tsx
render(<ReportsPanel projects={[project]} />);
expect(screen.getByRole("heading", { name: /availability reports/i })).toBeInTheDocument();
expect(screen.getByLabelText(/report project/i)).toBeInTheDocument();
expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run admin tests and verify `ReportsPanel` is missing**

Run: `npm test -- src/components/admin-view.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add admin-protected routes and a compact report section**

Both handlers must return 401 without the admin cookie and validate project/date input. The panel defaults to weekly mode/current Monday, loads the selected report, displays target/available/carry/remaining states, offers monthly aggregation, and serializes the currently displayed rows to escaped CSV.

- [ ] **Step 4: Run admin tests and typecheck**

Run: `npm test -- src/components/admin-view.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminApp.tsx src/components/admin-view.test.tsx src/app/api/reports/weekly/route.ts src/app/api/reports/monthly/route.ts src/app/globals.css
git commit -m "feat: add admin availability reports"
```

### Task 8: Documentation, Full Verification, and Main Deployment

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Verify: `.gitignore`

**Interfaces:**
- Produces: deployment/API documentation matching the shipped routes and a verified `main` commit.
- Consumes: all prior tasks.

- [ ] **Step 1: Update operator and agent documentation**

Document required `projectId`, optional `week`, example weekly/monthly responses, reminder semantics, Monday-to-Sunday accounting, global cross-project totals, migration behaviour, and CSV reporting. Confirm `.env.example` contains names only/example values and `.gitignore` excludes `*.db`, `*.db-shm`, `*.db-wal`, and `.env.local`.

- [ ] **Step 2: Run all automated checks**

Run: `npm test && npm run typecheck && npm run build && git diff --check`
Expected: all tests pass, TypeScript exits zero, Next production build exits zero, and diff check prints nothing.

- [ ] **Step 3: Perform a local HTTP smoke test**

Run the production server using an isolated temporary SQLite path and verify `/api/health`, the unauthenticated member gate, agent 401 without a token, and agent 400 without `projectId`. If Docker is available, also run `sh scripts/docker-smoke.sh`.

- [ ] **Step 4: Review the final diff for privacy and generated files**

Run: `git status --short && git diff --stat origin/main...HEAD && git ls-files | rg '(\.db($|-)|\.env\.local$)' || true`
Expected: only intentional source/docs changes; no database or local secret file is tracked.

- [ ] **Step 5: Commit documentation and verified release state**

```bash
git add README.md .env.example
git commit -m "docs: describe scoped availability reporting"
```

- [ ] **Step 6: Push the verified branch to production `main`**

```bash
git fetch origin main
git rebase origin/main
git push origin HEAD:main
```

Expected: push succeeds without force, and Coolify receives the new `main` commit for automatic deployment.
