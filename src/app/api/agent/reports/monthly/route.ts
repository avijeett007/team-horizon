import { NextResponse } from "next/server";
import { AgentAuthError, requireAgentToken } from "@/lib/agent-auth";
import { requireProjectId } from "@/lib/api-policy";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { buildMonthlyReport } from "@/lib/reports";

export async function GET(request: Request) {
  try {
    requireAgentToken(request);
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const month = url.searchParams.get("month");
    if (!month) throw new Error("month is required in YYYY-MM format");
    const db = await getDb();
    return NextResponse.json(await buildMonthlyReport(db, projectId, month));
  } catch (error) {
    return NextResponse.json({ error: publicDatabaseError(error) }, { status: error instanceof AgentAuthError ? error.status : 400 });
  }
}
