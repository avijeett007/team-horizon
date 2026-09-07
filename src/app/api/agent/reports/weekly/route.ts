import { NextResponse } from "next/server";
import { AgentAuthError, requireAgentToken } from "@/lib/agent-auth";
import { requireProjectId } from "@/lib/api-policy";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { buildWeeklyReport } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    requireAgentToken(request);
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const week = url.searchParams.get("week");
    if (!week) throw new Error("week is required and accepts any ISO date within the intended week");
    const db = await getDb();
    return NextResponse.json(await buildWeeklyReport(db, projectId, week));
  } catch (error) {
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: error instanceof AgentAuthError ? error.status : 400 });
  }
}
