import { NextResponse } from "next/server";
import { z } from "zod";
import { assertWritableProject, isProjectAccessError } from "@/lib/api-policy";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { deleteOwnedEntry, updateOwnedEntry } from "@/lib/repository";
import { currentMemberId } from "@/lib/server-access";
import { errorMessage } from "@/lib/validation";

const patchSchema = z.object({
  status: z.enum(["available", "tentative", "busy", "leave"]).optional(),
  projectId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(240).nullable().optional(),
  leaveCertainty: z.enum(["confirmed", "provisional"]).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
  try {
    const { id } = await params;
    const patch = patchSchema.parse(await request.json());
    const db = await getDb();
    if ("projectId" in patch) await assertWritableProject(db, memberId, patch.projectId ?? null);
    return NextResponse.json({ entry: await updateOwnedEntry(db, memberId, Number(id), patch) });
  } catch (error) { return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: isProjectAccessError(error) ? 403 : 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const ok = await deleteOwnedEntry(db, memberId, Number(id));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
