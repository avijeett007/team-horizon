import { NextResponse } from "next/server";
import { AgentAuthError, requireAgentToken } from "@/lib/agent-auth";
import { requireProjectId } from "@/lib/api-policy";
import { getDb } from "@/lib/db";
import { buildWeeklyReport } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    requireAgentToken(request);
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const week = url.searchParams.get("week");
    if (!week) throw new Error("week is required and accepts any ISO date within the intended week");
    return NextResponse.json(buildWeeklyReport(getDb(), projectId, week));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: error instanceof AgentAuthError ? error.status : 400 });
  }
}
