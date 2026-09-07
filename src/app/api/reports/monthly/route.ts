import { NextResponse } from "next/server";
import { requireProjectId } from "@/lib/api-policy";
import { getDb } from "@/lib/db";
import { buildMonthlyReport } from "@/lib/reports";
import { hasAdminAccess } from "@/lib/server-access";

export async function GET(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const month = url.searchParams.get("month");
    if (!month) throw new Error("month is required in YYYY-MM format");
    return NextResponse.json(buildMonthlyReport(getDb(), projectId, month));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
