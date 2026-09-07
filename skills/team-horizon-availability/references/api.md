# Team Horizon Agent API

## Connection

- Default base URL: `https://teams.kno2gether.com`
- Header: `Authorization: Bearer $TEAM_HORIZON_AGENT_TOKEN`
- All agent endpoints are read-only JSON APIs.
- HTTP 401 means the token is missing or invalid. HTTP 503 means agent access is disabled or the database is unavailable. HTTP 400 usually means a parameter or project is invalid.

Use the helper for normal work. Call the raw endpoints only for a question the helper does not yet summarize.

## Project directory

`GET /api/agent/projects`

Returns active projects with ID, name, colour, venture, member count, and assigned members. Resolve project names with this endpoint instead of hardcoding IDs.

Useful for project rosters, timezone distribution, notification recipients, and checking who belongs to a project.

## Availability

`GET /api/agent/availability`

Required query parameters:

- `projectId`: one active project ID
- `from`: ISO timestamp, inclusive window start
- `to`: ISO timestamp, exclusive window end; range must be 366 days or less

Optional query parameters:

- `week`: any ISO date in the accounting week used for `weeklyStatus`
- `member`: member ID; repeat to select several people

Returns:

- `generatedAt` and requested `range`
- selected `project` and `venture`
- project-scoped `members`
- overlapping `entries`
- global-per-person `weeklyStatus` for those project members

Entry statuses are `available`, `tentative`, `busy`, and `leave`. Busy and leave override an overlapping available or tentative declaration for operational scheduling. Another project's constraint remains visible but its project details and note may be redacted.

Granular uses include:

- confirmed availability now or within a look-ahead window
- tentative alternatives when nobody is confirmed
- current leave/busy constraints
- next declared availability
- support-ticket recipient selection
- future staffing gaps and declaration freshness
- common meeting or catch-up windows
- per-person schedules using repeated `member` parameters

Never translate an empty result into “not working” or “absent.” Say the calendar has no matching declaration.

## Weekly coverage

`GET /api/agent/reports/weekly?projectId=ID&week=YYYY-MM-DD`

The response normalizes `week` to Monday and includes the Sunday end date. Each member row includes:

- `baseTargetHours`: normally 40
- `carryInHours`: outstanding hours brought into the week
- `targetHours`: base plus carry
- `availableHours`: unique declared `available` hours across every project
- `remainingHours`: target still uncovered at week end/current calculation
- `complete`: whether the target is covered
- `submissionDueAt`: Monday 09:00 in that member's timezone, expressed as an ISO timestamp
- `reminderNeeded`: incomplete after the submission deadline

Only `available` entries count. Tentative, busy, confirmed leave, and provisional leave do not count. Overlapping availability counts once. Surplus is not banked.

Useful outputs include reminder lists, members with zero declared hours, carried deficits, coverage completion, and how many hours remain. When combining projects, deduplicate by email because a member's same global total appears in every project they belong to.

## Monthly history

`GET /api/agent/reports/monthly?projectId=ID&month=YYYY-MM`

Includes Monday-starting weeks in the month and, for each project member:

- total base target and available hours
- opening carry and closing deficit
- completed and total weeks
- full `weeklyStatuses`

Useful for recurring coverage gaps, improving or worsening deficits, monthly planning, and identifying a reminder that remains unresolved. Present these as calendar completeness and declared capacity, not employee performance.

## Safe notification pattern

A reminder candidate should normally satisfy `reminderNeeded: true`. Include the selected week, available hours, total target, remaining hours, and carry-in when non-zero. Keep the wording voluntary and operational: ask the member to update declared availability so work and meetings can be planned.

Do not send messages solely because the API returned a candidate. Use the available messaging system only when the user has authorized sending, and avoid duplicate notifications within the same reminder run.
