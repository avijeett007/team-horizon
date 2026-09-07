import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const root = process.cwd();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the PostgreSQL E2E test");

const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const schema = `team_horizon_e2e_${suffix}`;
if (!/^team_horizon_e2e_\d+_\d+$/.test(schema)) throw new Error("Refusing unsafe E2E schema name");

const port = 31_000 + Math.floor(Math.random() * 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const adminPin = "postgres-e2e-admin-pin";
const sessionSecret = "postgres-e2e-session-secret-at-least-32-characters";
const agentToken = "postgres-e2e-agent-token";
const control = new Pool({ connectionString });
let server = null;

function mondayOnOrAfterToday() {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + ((8 - weekday) % 7));
  return value.toISOString().slice(0, 10);
}

function plusDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  const stopped = once(server, "exit");
  const timeout = new Promise((resolve) => setTimeout(resolve, 5_000, "timeout"));
  if (await Promise.race([stopped.then(() => "stopped"), timeout]) === "timeout") {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
}

async function startServer() {
  let output = "";
  server = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_SCHEMA: schema,
      ADMIN_PIN: adminPin,
      SESSION_SECRET: sessionSecret,
      AGENT_API_TOKEN: agentToken,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(-20_000);
    });
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Application exited before becoming healthy\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok && (await response.json()).ok === true) return;
    } catch {
      // Server startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Application did not become healthy\n${output}`);
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${pathname}: ${JSON.stringify(data)}`);
  return { data, response };
}

function responseCookie(response) {
  const value = response.headers.get("set-cookie");
  if (!value) throw new Error("Expected an authentication cookie");
  return value.split(";", 1)[0];
}

try {
  await control.query(`CREATE SCHEMA "${schema}"`);
  await startServer();

  const adminSession = await request("/api/admin/session", {
    method: "POST",
    body: JSON.stringify({ pin: adminPin }),
  });
  const adminCookie = responseCookie(adminSession.response);
  const adminHeaders = { cookie: adminCookie };

  const venture = (await request("/api/ventures", {
    method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "Knotie E2E", colour: "#466CFF" }),
  })).data.venture;
  const otherVenture = (await request("/api/ventures", {
    method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "Hexai E2E", colour: "#4E9C81" }),
  })).data.venture;
  const project = (await request("/api/projects", {
    method: "POST", headers: adminHeaders, body: JSON.stringify({ ventureId: venture.id, name: "Launch E2E", colour: "#F27D68" }),
  })).data.project;
  const otherProject = (await request("/api/projects", {
    method: "POST", headers: adminHeaders, body: JSON.stringify({ ventureId: otherVenture.id, name: "Private E2E", colour: "#9B72CF" }),
  })).data.project;

  const member = (await request("/api/members", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Asha E2E", email: "asha.e2e@example.com", location: "London", timezone: "Europe/London",
      ventureIds: [venture.id], projectIds: [project.id],
    }),
  })).data.member;
  await request("/api/members", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Outsider E2E", email: "outsider.e2e@example.com", location: "Pune", timezone: "Asia/Kolkata",
      ventureIds: [otherVenture.id], projectIds: [otherProject.id],
    }),
  });

  const memberSession = await request("/api/session", {
    method: "POST",
    body: JSON.stringify({ email: "ASHA.E2E@example.com" }),
  });
  const memberCookie = responseCookie(memberSession.response);
  const memberHeaders = { cookie: memberCookie };

  const bootstrap = (await request(`/api/bootstrap?projectId=${project.id}`, { headers: memberHeaders })).data;
  if (bootstrap.members.length !== 1 || bootstrap.members[0].id !== member.id) {
    throw new Error("Project-scoped bootstrap exposed an unrelated member");
  }

  const week = mondayOnOrAfterToday();
  const entryDate = plusDays(week, 1);
  const created = (await request("/api/entries", {
    method: "POST",
    headers: memberHeaders,
    body: JSON.stringify({
      date: entryDate, startTime: "09:00", endTime: "17:00", timezone: "Europe/London",
      status: "available", projectId: project.id, note: "PostgreSQL E2E", leaveCertainty: null, recurrence: null,
    }),
  })).data.entries;
  if (created.length !== 1) throw new Error("Expected one materialised availability entry");

  await request("/api/entries", {
    method: "POST",
    headers: memberHeaders,
    body: JSON.stringify({
      date: plusDays(week, 2), startTime: "09:00", endTime: "17:00", timezone: "Europe/London",
      status: "tentative", projectId: project.id, note: null, leaveCertainty: null, recurrence: null,
    }),
  });

  const weekly = (await request(`/api/weekly-status?week=${week}`, { headers: memberHeaders })).data.status;
  if (weekly.availableHours !== 8 || weekly.remainingHours !== 32 || weekly.targetHours !== 40) {
    throw new Error(`Unexpected weekly ledger result: ${JSON.stringify(weekly)}`);
  }

  const rangeFrom = `${week}T00:00:00.000Z`;
  const rangeTo = `${plusDays(week, 7)}T00:00:00.000Z`;
  const agent = (await request(
    `/api/agent/availability?projectId=${project.id}&week=${week}&from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
    { headers: { authorization: `Bearer ${agentToken}` } },
  )).data;
  if (agent.weeklyStatus[0].remainingHours !== 32 || agent.entries.length !== 2) {
    throw new Error("Agent API did not expose the persisted availability and weekly deficit");
  }

  await stopServer();
  await startServer();

  const persistedBootstrap = (await request(`/api/bootstrap?projectId=${project.id}`, { headers: memberHeaders })).data;
  if (persistedBootstrap.sessionMember.id !== member.id) throw new Error("Member did not persist across restart");
  const persistedEntries = (await request(
    `/api/entries?projectId=${project.id}&from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`,
    { headers: memberHeaders },
  )).data.entries;
  if (persistedEntries.length !== 2 || !persistedEntries.some((entry) => entry.note === "PostgreSQL E2E")) {
    throw new Error("Availability did not persist across restart");
  }

  console.log("PostgreSQL API, agent ledger, project scope, and restart persistence checks passed.");
} finally {
  await stopServer();
  await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await control.end();
}
