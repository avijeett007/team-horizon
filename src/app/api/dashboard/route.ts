import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { isProjectAccessError, requireProjectId } from "@/lib/api-policy";
import { buildDashboard } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { assertMemberCanUseProject, projectAudience, scopedEntries } from "@/lib/project-scope";
import { currentMemberId } from "@/lib/server-access";
import { errorMessage } from "@/lib/validation";

export async function GET(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const projectId = requireProjectId(url.searchParams);
    const zone = url.searchParams.get("zone") ?? "Europe/London";
    const now = DateTime.utc();
    const from = now.setZone(zone).startOf("day").toUTC();
    const to = from.plus({ days: 8 });
    const db = getDb();
    assertMemberCanUseProject(db, memberId, projectId);
    const members = projectAudience(db, projectId).members;
    const entries = scopedEntries(db, projectId, memberId, from.toISO()!, to.toISO()!);
    return NextResponse.json(buildDashboard({ now: now.toISO()!, zone, members, entries }));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: isProjectAccessError(error) ? 403 : 400 });
  }
}
