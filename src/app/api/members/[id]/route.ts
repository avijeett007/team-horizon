import { NextResponse } from "next/server";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { archiveReference, updateMember } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, memberInputSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const { id } = await params;
    const input = memberInputSchema.parse(await request.json());
    const db = await getDb();
    return NextResponse.json({ member: await updateMember(db, Number(id), input) });
  } catch (error) { return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  return NextResponse.json({ ok: await archiveReference(db, "member", Number(id)) });
}
