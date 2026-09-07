---
name: team-horizon-availability
description: Use when answering questions about Team Horizon staff availability, project rosters, 40-hour coverage, carried deficits, reminders, leave or tentative declarations, and common meeting windows.
---

# Team Horizon Availability

Use Team Horizon as a declaration calendar, never as evidence of attendance, activity, or performance. The API is read-only and every result is scoped to a project.

## Setup

Set `TEAM_HORIZON_AGENT_TOKEN`. The production URL is the default; set `TEAM_HORIZON_BASE_URL` only for another deployment. Never print, echo, or include the token in an answer.

Run `node scripts/team-horizon-api.mjs help` from this skill directory for the current command list. Read [references/api.md](references/api.md) when raw fields, custom ranges, or error handling are needed.

## Workflow

1. Run `projects` when the project name or ID is unknown. Match the requested project before querying people.
2. Choose the narrowest command and time range that answers the question.
3. State the generation time and relevant timezone or UTC range.
4. Describe results as **declared availability**. No matching declaration means **unknown**, not unavailable.
5. Keep confirmed availability, tentative time, busy time, and leave distinct.

## Commands

```bash
node scripts/team-horizon-api.mjs projects
node scripts/team-horizon-api.mjs window --project "Knotie" --minutes 60
node scripts/team-horizon-api.mjs entries --project "Knotie" --from 2026-09-08T08:00:00Z --to 2026-09-08T18:00:00Z --status leave,tentative
node scripts/team-horizon-api.mjs weekly --project "Knotie" --week 2026-09-07
node scripts/team-horizon-api.mjs monthly --project "Knotie" --month 2026-09
node scripts/team-horizon-api.mjs common --project "Knotie" --member asha@example.com --member ben@example.com --from 2026-09-08T08:00:00Z --to 2026-09-08T18:00:00Z --duration 30
```

Use `--at ISO` for a historical or future window. `--member` accepts an ID, exact name, or email and may be repeated. `entries` accepts comma-separated statuses: `available`, `tentative`, `busy`, and `leave`.

## Interpretation

- `availableNow` is confirmed declared availability after busy or leave overlaps are removed. `tentativeNow` is never promoted to confirmed.
- `undeclaredNow` means the calendar does not answer the question.
- The 40-hour target is global per person across all projects. Project reports contain only that project's members, but their hours and deficit are global. Deduplicate cross-project rollups by member email.
- `carryInHours` is the deficit brought from earlier weeks. `targetHours` is base target plus carry. `remainingHours` is the deficit left after the selected week.
- Use `reminderNeeded` for notification candidates; `missingDeclarations` is a stronger data-quality signal but may precede the reminder deadline.
- Common windows use confirmed availability only and subtract busy/leave intervals.

The skill may prepare recipients, reasons, and suggested reminder text. Sending a notification still requires a separate messaging tool and user authorization.
