import { NextResponse } from "next/server";
import { buildMemberBootstrap, isProjectAccessError } from "@/lib/api-policy";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { findMemberById, listBootstrap } from "@/lib/repository";
import { currentMemberId, hasAdminAccess } from "@/lib/server-access";

export async function GET(request: Request) {
  try {
    const db = await getDb();
    const memberId = await currentMemberId();
    const admin = await hasAdminAccess();
    const data = await listBootstrap(db);
    if (admin) return NextResponse.json({ ...data, sessionMember: memberId ? await findMemberById(db, memberId) : null, selectedProject: null, selectableProjects: data.projects, admin: true, hasMembers: true });
    if (!memberId) return NextResponse.json({ members: [], ventures: [], projects: [], selectableProjects: [], selectedProject: null, sessionMember: null, admin: false, hasMembers: data.members.length > 0 });
    const rawProjectId = new URL(request.url).searchParams.get("projectId");
    const projectId = rawProjectId == null ? undefined : Number(rawProjectId);
    if (rawProjectId != null && (!Number.isInteger(projectId) || projectId! <= 0)) throw new Error("projectId must be a positive integer");
    return NextResponse.json(await buildMemberBootstrap(db, memberId, projectId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open this project";
    return NextResponse.json({ error: publicDatabaseError(error, message) }, { status: isProjectAccessError(error) ? 403 : 400 });
  }
}
