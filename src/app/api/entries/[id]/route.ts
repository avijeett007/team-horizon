import { NextResponse } from "next/server";
import { z } from "zod";
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
    return NextResponse.json({ entry: updateOwnedEntry(getDb(), memberId, Number(id), patchSchema.parse(await request.json())) });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
  const { id } = await params;
  const ok = deleteOwnedEntry(getDb(), memberId, Number(id));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
