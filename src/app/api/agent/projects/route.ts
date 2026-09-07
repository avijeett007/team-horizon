import { NextResponse } from "next/server";
import { buildAgentProjectDirectory } from "@/lib/agent-projects";
import { AgentAuthError, requireAgentToken } from "@/lib/agent-auth";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    requireAgentToken(request);
    return NextResponse.json(await buildAgentProjectDirectory(await getDb()));
  } catch (error) {
    return NextResponse.json(
      { error: publicDatabaseError(error) },
      { status: error instanceof AgentAuthError ? error.status : 400 },
    );
  }
}
