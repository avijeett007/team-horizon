import { NextResponse } from "next/server";
import { buildMemberBootstrap, isProjectAccessError } from "@/lib/api-policy";
import { getDb } from "@/lib/db";
import { findMemberById, listBootstrap } from "@/lib/repository";
import { currentMemberId, hasAdminAccess } from "@/lib/server-access";

export async function GET(request: Request) {
  const db = getDb();
  const memberId = await currentMemberId();
  const admin = await hasAdminAccess();
  if (admin) return NextResponse.json({ ...listBootstrap(db), sessionMember: memberId ? findMemberById(db, memberId) : null, selectedProject: null, selectableProjects: listBootstrap(db).projects, admin: true, hasMembers: true });
  if (!memberId) return NextResponse.json({ members: [], ventures: [], projects: [], selectableProjects: [], selectedProject: null, sessionMember: null, admin: false, hasMembers: listBootstrap(db).members.length > 0 });
  try {
    const rawProjectId = new URL(request.url).searchParams.get("projectId");
    const projectId = rawProjectId == null ? undefined : Number(rawProjectId);
    if (rawProjectId != null && (!Number.isInteger(projectId) || projectId! <= 0)) throw new Error("projectId must be a positive integer");
    return NextResponse.json(buildMemberBootstrap(db, memberId, projectId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open this project" }, { status: isProjectAccessError(error) ? 403 : 400 });
  }
}
