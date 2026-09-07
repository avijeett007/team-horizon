import { NextResponse } from "next/server";
import { requireProjectId } from "@/lib/api-policy";
import { getDb } from "@/lib/db";
import { buildWeeklyReport } from "@/lib/reports";
import { hasAdminAccess } from "@/lib/server-access";

export async function GET(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const week = url.searchParams.get("week");
    if (!week) throw new Error("week is required and accepts any ISO date within the intended week");
    return NextResponse.json(buildWeeklyReport(getDb(), projectId, week));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
