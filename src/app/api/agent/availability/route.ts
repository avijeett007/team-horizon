import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { AgentAuthError, requireAgentToken } from "@/lib/agent-auth";
import { requireProjectId } from "@/lib/api-policy";
import { getDb } from "@/lib/db";
import { projectAudience, scopedEntries } from "@/lib/project-scope";
import { weeklyStatusForMember } from "@/lib/weekly-ledger";

export async function GET(request: Request) {
  try {
    requireAgentToken(request);
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) throw new Error("from and to are required ISO timestamps");
    const db = getDb();
    const audience = projectAudience(db, projectId);
    const requestedIds = url.searchParams.getAll("member").map(Number).filter(Number.isInteger);
    const members = requestedIds.length ? audience.members.filter((member) => requestedIds.includes(member.id)) : audience.members;
    const week = url.searchParams.get("week");
    const generatedAt = DateTime.utc().toISO()!;
    const weeklyStatus = members.map((member) => weeklyStatusForMember(
      db,
      member,
      week ?? DateTime.now().setZone(member.timezone).toISODate()!,
      generatedAt,
    ));
    const entries = scopedEntries(db, projectId, null, from, to, members.map((member) => member.id));
    return NextResponse.json({ generatedAt, range: { from, to }, project: audience.selectedProject, venture: audience.ventures[0], members, entries, weeklyStatus });
  } catch (error) {
    const status = error instanceof AgentAuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status });
  }
}
