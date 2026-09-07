#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://teams.kno2gether.com";

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error(`Invalid ISO date/time: ${value}`);
  return date.toISOString();
}

function overlaps(entry, start, end) {
  return Date.parse(entry.endsAtUtc) > start && Date.parse(entry.startsAtUtc) < end;
}

function merge(intervals) {
  const sorted = intervals
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const result = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (!last || interval[0] > last[1]) result.push([...interval]);
    else last[1] = Math.max(last[1], interval[1]);
  }
  return result;
}

function subtract(intervals, blockers) {
  let result = merge(intervals);
  for (const [blockStart, blockEnd] of merge(blockers)) {
    result = result.flatMap(([start, end]) => {
      if (blockEnd <= start || blockStart >= end) return [[start, end]];
      const pieces = [];
      if (blockStart > start) pieces.push([start, blockStart]);
      if (blockEnd < end) pieces.push([blockEnd, end]);
      return pieces;
    });
  }
  return result;
}

function memberSegments(entries, memberId, start = -Infinity, end = Infinity, status = "available") {
  const own = entries.filter((entry) => entry.memberId === memberId);
  const declared = own
    .filter((entry) => entry.status === status)
    .map((entry) => [Math.max(start, Date.parse(entry.startsAtUtc)), Math.min(end, Date.parse(entry.endsAtUtc))]);
  const blockers = own
    .filter((entry) => entry.status === "busy" || entry.status === "leave")
    .map((entry) => [Math.max(start, Date.parse(entry.startsAtUtc)), Math.min(end, Date.parse(entry.endsAtUtc))]);
  return subtract(declared, blockers);
}

function person(member, extra = {}) {
  return { memberId: member.id, name: member.name, email: member.email, timezone: member.timezone, ...extra };
}

export function summarizeWindow(payload, atValue = new Date().toISOString(), lookaheadMinutes = 60) {
  const at = Date.parse(iso(atValue));
  const end = at + Number(lookaheadMinutes) * 60_000;
  if (!(end > at)) throw new Error("lookahead minutes must be greater than zero");
  const result = {
    checkedAtUtc: new Date(at).toISOString(),
    windowEndsUtc: new Date(end).toISOString(),
    availableNow: [],
    tentativeNow: [],
    busyNow: [],
    onLeaveNow: [],
    undeclaredNow: [],
    availableWithinWindow: [],
  };

  for (const member of payload.members ?? []) {
    const covering = (payload.entries ?? []).filter((entry) => entry.memberId === member.id && overlaps(entry, at, at + 1));
    if (covering.some((entry) => entry.status === "leave")) result.onLeaveNow.push(person(member));
    else if (covering.some((entry) => entry.status === "busy")) result.busyNow.push(person(member));
    else if (covering.some((entry) => entry.status === "available")) result.availableNow.push(person(member));
    else if (covering.some((entry) => entry.status === "tentative")) result.tentativeNow.push(person(member));
    else result.undeclaredNow.push(person(member));

    const segment = memberSegments(payload.entries ?? [], member.id, at, end)[0];
    if (segment) {
      result.availableWithinWindow.push(person(member, {
        availableFromUtc: new Date(segment[0]).toISOString(),
        availableUntilUtc: new Date(segment[1]).toISOString(),
        startsInMinutes: Math.max(0, Math.round((segment[0] - at) / 60_000)),
      }));
    }
  }
  result.blockedNow = [...result.busyNow, ...result.onLeaveNow];
  return result;
}

export function summarizeCoverage(payload) {
  const statuses = payload.weeklyStatus ?? payload.members ?? [];
  const normalized = statuses.map((status) => ({
    memberId: status.memberId,
    name: status.memberName ?? status.name,
    email: status.email,
    timezone: status.timezone,
    baseTargetHours: status.baseTargetHours,
    carryInHours: status.carryInHours,
    targetHours: status.targetHours,
    availableHours: status.availableHours,
    remainingHours: status.remainingHours,
    complete: status.complete,
    reminderNeeded: status.reminderNeeded,
    submissionDueAt: status.submissionDueAt,
  }));
  return {
    members: normalized,
    reminders: normalized.filter((status) => status.reminderNeeded),
    incomplete: normalized.filter((status) => status.targetHours > 0 && status.remainingHours > 0),
    missingDeclarations: normalized.filter((status) => status.targetHours > 0 && status.availableHours === 0),
    withCarry: normalized.filter((status) => status.carryInHours > 0),
    complete: normalized.filter((status) => status.targetHours > 0 && status.complete),
  };
}

export function commonWindows(payload, memberIds, minimumMinutes = 30) {
  if (!memberIds.length) return [];
  const rangeStart = payload.range?.from ? Date.parse(payload.range.from) : -Infinity;
  const rangeEnd = payload.range?.to ? Date.parse(payload.range.to) : Infinity;
  let common = null;
  for (const memberId of memberIds) {
    const segments = memberSegments(payload.entries ?? [], memberId, rangeStart, rangeEnd);
    if (common == null) common = segments;
    else {
      const intersection = [];
      for (const [aStart, aEnd] of common) {
        for (const [bStart, bEnd] of segments) {
          const start = Math.max(aStart, bStart);
          const end = Math.min(aEnd, bEnd);
          if (end > start) intersection.push([start, end]);
        }
      }
      common = merge(intersection);
    }
  }
  return (common ?? [])
    .filter(([start, end]) => end - start >= Number(minimumMinutes) * 60_000)
    .map(([start, end]) => ({
      startsAtUtc: new Date(start).toISOString(),
      endsAtUtc: new Date(end).toISOString(),
      durationMinutes: Math.round((end - start) / 60_000),
    }));
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const value = rest[index + 1];
    if (value == null || value.startsWith("--")) options[key] = true;
    else {
      if (options[key] == null) options[key] = value;
      else options[key] = Array.isArray(options[key]) ? [...options[key], value] : [options[key], value];
      index += 1;
    }
  }
  return { command, options };
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item));
  }
  return search.toString();
}

async function client() {
  const token = process.env.TEAM_HORIZON_AGENT_TOKEN ?? process.env.AGENT_API_TOKEN;
  if (!token) throw new Error("Set TEAM_HORIZON_AGENT_TOKEN (or AGENT_API_TOKEN)");
  const base = (process.env.TEAM_HORIZON_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  async function get(path) {
    const response = await fetch(base + path, { headers: { authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${response.status} ${body.error ?? response.statusText}`);
    return body;
  }
  return { get };
}

async function resolveProject(api, value) {
  if (!value) throw new Error("--project is required (project name or ID)");
  const directory = await api.get("/api/agent/projects");
  const exactId = Number(value);
  const matches = directory.projects.filter((project) =>
    (Number.isInteger(exactId) && project.id === exactId) || project.name.toLowerCase() === String(value).toLowerCase());
  if (matches.length !== 1) throw new Error(`Project not found or ambiguous: ${value}`);
  return matches[0];
}

function selectMembers(members, values) {
  const requested = (Array.isArray(values) ? values : values ? [values] : [])
    .flatMap((value) => String(value).split(",")).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!requested.length) return members;
  const selected = members.filter((member) => requested.includes(String(member.id))
    || requested.includes(member.email.toLowerCase()) || requested.includes(member.name.toLowerCase()));
  if (selected.length !== requested.length) throw new Error("One or more --member values did not uniquely match the project roster");
  return selected;
}

function help() {
  return {
    usage: "node team-horizon-api.mjs <command> [options]",
    commands: {
      projects: "List projects, ventures, and assigned members",
      window: "Current and upcoming declared availability: --project NAME [--at ISO] [--minutes 60]",
      entries: "Declarations in a range: --project NAME --from ISO --to ISO [--status available] [--member EMAIL]",
      weekly: "Coverage, reminders, missing declarations, and carry: --project NAME [--week YYYY-MM-DD]",
      monthly: "Monthly history: --project NAME [--month YYYY-MM]",
      common: "Common confirmed time: --project NAME --member EMAIL --member EMAIL --from ISO --to ISO [--duration 30]",
    },
  };
}

async function main(argv) {
  const { command, options } = parseArgs(argv);
  if (command === "help" || options.help) return help();
  const api = await client();
  if (command === "projects") return api.get("/api/agent/projects");
  const project = await resolveProject(api, options.project);

  if (command === "weekly") {
    const week = options.week ?? new Date().toISOString().slice(0, 10);
    const report = await api.get(`/api/agent/reports/weekly?${query({ projectId: project.id, week })}`);
    return { generatedAt: report.generatedAt, project: report.project, weekStart: report.weekStart, weekEnd: report.weekEnd, definitions: report.definitions, ...summarizeCoverage(report) };
  }
  if (command === "monthly") {
    const month = options.month ?? new Date().toISOString().slice(0, 7);
    return api.get(`/api/agent/reports/monthly?${query({ projectId: project.id, month })}`);
  }

  const at = options.at ?? new Date().toISOString();
  const from = command === "window" ? iso(at) : iso(options.from);
  const to = command === "window"
    ? new Date(Date.parse(from) + Number(options.minutes ?? 60) * 60_000).toISOString()
    : iso(options.to);
  const selected = selectMembers(project.members, options.member);
  const payload = await api.get(`/api/agent/availability?${query({
    projectId: project.id,
    week: from.slice(0, 10),
    from,
    to,
    member: selected.map((member) => member.id),
  })}`);

  if (command === "window") return { project: payload.project, ...summarizeWindow(payload, from, Number(options.minutes ?? 60)), coverage: summarizeCoverage(payload) };
  if (command === "entries") {
    const statuses = options.status ? String(options.status).split(",") : null;
    return { generatedAt: payload.generatedAt, project: payload.project, range: payload.range, members: payload.members, entries: statuses ? payload.entries.filter((entry) => statuses.includes(entry.status)) : payload.entries };
  }
  if (command === "common") return { generatedAt: payload.generatedAt, project: payload.project, members: selected, minimumDurationMinutes: Number(options.duration ?? 30), windows: commonWindows(payload, selected.map((member) => member.id), Number(options.duration ?? 30)) };
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ error: error.message }));
      process.exitCode = 1;
    });
}
