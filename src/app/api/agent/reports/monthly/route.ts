import { NextResponse } from "next/server";
import { AgentAuthError, requireAgentToken } from "@/lib/agent-auth";
import { requireProjectId } from "@/lib/api-policy";
import { getDb } from "@/lib/db";
import { buildMonthlyReport } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    requireAgentToken(request);
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const month = url.searchParams.get("month");
    if (!month) throw new Error("month is required in YYYY-MM format");
    return NextResponse.json(buildMonthlyReport(getDb(), projectId, month));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: error instanceof AgentAuthError ? error.status : 400 });
  }
}
