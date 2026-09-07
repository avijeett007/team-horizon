import { NextResponse } from "next/server";
import { assertWritableProject, isProjectAccessError, requireProjectId } from "@/lib/api-policy";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { assertMemberCanUseProject, scopedEntries } from "@/lib/project-scope";
import { createEntries } from "@/lib/repository";
import { currentMemberId } from "@/lib/server-access";
import { entryInputSchema, errorMessage } from "@/lib/validation";

export async function GET(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Enter your team email before viewing availability" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) throw new Error("A start and end date are required");
    const projectId = requireProjectId(url.searchParams);
    const db = await getDb();
    await assertMemberCanUseProject(db, memberId, projectId);
    const members = url.searchParams.getAll("member").map(Number).filter(Number.isFinite);
    return NextResponse.json({ entries: await scopedEntries(db, projectId, memberId, from, to, members) });
  } catch (error) { return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: isProjectAccessError(error) ? 403 : 400 }); }
}

export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Enter your team email before adding availability" }, { status: 401 });
  try {
    const input = entryInputSchema.parse(await request.json());
    const db = await getDb();
    await assertWritableProject(db, memberId, input.projectId);
    return NextResponse.json({ entries: await createEntries(db, memberId, input) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: isProjectAccessError(error) ? 403 : 400 }); }
}
