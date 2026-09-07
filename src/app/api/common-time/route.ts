import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRequestedMembersInProject, isProjectAccessError } from "@/lib/api-policy";
import { findCommonSlots } from "@/lib/common-time";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { assertMemberCanUseProject, scopedEntries } from "@/lib/project-scope";
import { currentMemberId } from "@/lib/server-access";
import { errorMessage } from "@/lib/validation";

const schema = z.object({
  projectId: z.number().int().positive(),
  memberIds: z.array(z.number().int().positive()).min(2),
  fromUtc: z.iso.datetime(),
  toUtc: z.iso.datetime(),
  minimumMinutes: z.number().int().min(15).max(480).default(30),
});

export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    if (Date.parse(input.toUtc) - Date.parse(input.fromUtc) > 31 * 86_400_000) throw new Error("Common-time searches are limited to 31 days");
    const db = await getDb();
    await assertMemberCanUseProject(db, memberId, input.projectId);
    await assertRequestedMembersInProject(db, input.projectId, input.memberIds);
    const entries = await scopedEntries(db, input.projectId, memberId, input.fromUtc, input.toUtc, input.memberIds);
    return NextResponse.json({ slots: findCommonSlots({ ...input, entries }) });
  } catch (error) { return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: isProjectAccessError(error) ? 403 : 400 }); }
}
