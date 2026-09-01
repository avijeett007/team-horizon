import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveReference, updateMember } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, memberInputSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const { id } = await params;
    const input = memberInputSchema.parse(await request.json());
    return NextResponse.json({ member: updateMember(getDb(), Number(id), input) });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ ok: archiveReference(getDb(), "member", Number(id)) });
}
