# Project Scoping and Weekly Availability Ledger — Design

## Purpose

Extend Team Horizon so ordinary members see calendars only for projects they belong to, while each member maintains one 40-hour weekly availability requirement across all projects. Deficits carry forward until repaid, and agents receive structured data for reminders and reports.

## Product rules

- Monday through Sunday is the accounting week in each member's configured IANA time zone.
- Each member has one 40-hour requirement across all projects, never 40 hours per project.
- Only entries with status `available` count toward the requirement.
- Tentative, busy/project, confirmed leave, and provisional leave count as zero hours.
- Overlapping available entries count once. A cross-midnight entry is divided correctly at week boundaries.
- A weekly deficit carries forward: `target = 40 + carry-in` and `deficit = max(0, target - available)`.
- Surplus availability repays an existing deficit but never creates credit that reduces a later week below 40 hours.
- The weekly target starts from a stored Monday. Existing members begin on the first Monday after this feature is deployed; new members begin on the first Monday on or after their creation date. No retroactive debt is created.
- Historical totals are derived from saved availability entries. Correcting a past entry recomputes that week and every later carry balance consistently.

## Project-scoped visibility

### Members

After email recognition, a member receives only their assigned active projects. The calendar requires one selected project and defaults to the first assignment. There is no ordinary-member “all projects” view.

For a selected project, the member may see:

- active members assigned to that project;
- availability, tentative time, busy time, and leave for those members;
- the project-scoped dashboard, common-time finder, and completeness information.

Entries belonging to another project still block or expose availability time because the shared colleague's real schedule matters, but their other project name and note are redacted to `Busy on another project`. The entry owner can see their own complete details. Members outside the selected project are never returned by the server.

### Administrators

The existing admin PIN grants an all-project view and access to reports. Admin functionality remains separate from ordinary member visibility.

### Agents

The bearer-token agent API requires a valid `projectId`. It returns only that project's active members and calendar data. Cross-project entry details are redacted. The same token may query any project; the project parameter defines the visibility boundary and reminder audience.

## Weekly ledger

### Calculation

For each requested member and week:

1. Convert the member's Monday 00:00 and following Monday 00:00 into UTC.
2. Select all of that member's `available` entries that overlap the interval.
3. Clamp entries to the interval and union overlapping or touching ranges.
4. Sum unique minutes and convert to decimal hours.
5. Starting at the member's requirement start week, calculate the opening carry, target, and closing deficit sequentially through the requested week.

The calculation is deterministic and does not store a mutable running balance. Calendar entries and the member requirement start date are the source of truth.

### Status model

Each weekly status contains:

- `memberId`, `memberName`, `email`, and `timezone`;
- `weekStart` and `weekEnd` as local ISO dates;
- `baseTargetHours` (40);
- `carryInHours`;
- `targetHours`;
- `availableHours`;
- `remainingHours`;
- `complete`;
- `submissionDueAt`, Monday 09:00 in the member's time zone;
- `reminderNeeded`, true when the due time has passed and remaining hours are greater than zero.

All hour values are rounded to two decimal places for output but calculated in integer minutes internally.

## Member interface

The existing layout, email gate, entry editor, calendar grid, and navigation remain recognisable.

Changes are limited to:

- the existing project filter becomes a required project switcher containing only the member's assignments;
- the calendar header gains a compact weekly progress element;
- normal state: `32 of 40 hours added · 8 remaining`;
- carry state: `32 of 46 hours added · includes 6 carried over`;
- complete state: `40-hour availability complete`;
- the entry editor shows a small preview of how each new available block changes the current week's remaining hours;
- tentative, busy, and leave selections state that they do not count toward weekly available hours.

The UI does not describe the ledger as attendance, performance, productivity, or time worked. It records declared future availability only.

## Reports

The Admin page gains a Reports section without changing member navigation.

### Weekly report

For a selected project and Monday, show every active project member's target, available hours, carry-in, remaining hours, completion state, and reminder state. The report notes that targets and balances are global across projects even though the audience is project-scoped.

### Monthly report

For a selected project and calendar month, include weeks whose Monday falls within that month. Show per-member total base target, total available hours, opening carry, closing deficit, and completed-week count. A CSV download uses the same server result.

## API changes

### Member-facing endpoints

- `/api/bootstrap?projectId=12` returns only members who share the selected project, plus `selectableProjects` containing the recognised member's assignments. Omitting `projectId` selects the first accessible project so the current email-entry flow still lands directly in the calendar.
- `/api/entries` requires `projectId` for reads and verifies that the current member belongs to it. Entry mutations remain self-only.
- Entry mutations may attach the owner's entry only to one of their assigned active projects (or leave it unassigned); a caller cannot write an inaccessible project ID.
- `/api/dashboard` and `/api/common-time` require `projectId` and enforce the same project membership rule.
- `/api/weekly-status?week=YYYY-MM-DD` returns the current member's global weekly status for the Monday containing the supplied date.

### Agent endpoints

The existing `/api/agent/availability` endpoint requires `projectId` and adds:

```json
{
  "project": { "id": 12, "name": "Example Project" },
  "weeklyStatus": [
    {
      "memberId": 3,
      "memberName": "Example Member",
      "email": "member@example.com",
      "timezone": "Europe/London",
      "weekStart": "2026-09-07",
      "weekEnd": "2026-09-13",
      "baseTargetHours": 40,
      "carryInHours": 5,
      "targetHours": 45,
      "availableHours": 32,
      "remainingHours": 13,
      "complete": false,
      "submissionDueAt": "2026-09-07T08:00:00.000Z",
      "reminderNeeded": true
    }
  ]
}
```

Optional `week=YYYY-MM-DD` selects the accounting week; it defaults to the current week. The existing bounded `from` and `to` calendar range remains available.

New endpoints:

- `/api/agent/reports/weekly?projectId=12&week=2026-09-07`
- `/api/agent/reports/monthly?projectId=12&month=2026-09`

Both are bearer-token protected, read-only, project-scoped, and return the same ledger definitions used by the interface.

## Data model and migration

Add `weekly_requirement_start TEXT` to `members`. Migration version 2 adds the column and sets existing active members to the first Monday after migration. Member creation calculates the first Monday on or after the creation date. The base target remains a code-level constant of 2,400 minutes because every member currently has the same requirement.

No weekly balance table is added. This avoids stale counters and preserves correction consistency. Existing calendar rows remain unchanged.

## Error handling

- A recognised member with no active project assignments sees a clear message asking an administrator to assign a project.
- Missing or inaccessible `projectId` returns 403 without confirming whether another project exists.
- Agent queries without `projectId` return 400 with the required parameter name.
- Invalid week values return 400 and explain that any date within the intended Monday–Sunday week is accepted.
- Ledger calculation before a member's requirement start returns a zero target and zero deficit.
- Report ranges are capped to protect the SQLite process.

## Testing and acceptance

Automated tests cover:

- members receive only assigned projects and same-project colleagues;
- multi-project members can switch projects but never receive an all-project member list;
- unrelated project names and notes are redacted server-side;
- administrators retain all-project visibility;
- overlapping available blocks count once;
- tentative, busy, and leave count as zero;
- cross-midnight and daylight-saving boundaries calculate correctly;
- deficits carry forward, surplus clears debt without banking credit, and historical edits recompute later balances;
- pre-start weeks produce no target or debt;
- weekly and monthly report totals;
- member, admin, and agent endpoints enforce project scope;
- agent status includes reminder-ready email, due time, remaining hours, and completion fields.

The release is accepted when the existing availability-entry workflow remains recognisable, ordinary members cannot retrieve unrelated project members through any endpoint, the weekly indicator agrees with the agent and report APIs, all automated checks and the production build pass, and the verified commit is pushed to `main` for automatic deployment.
