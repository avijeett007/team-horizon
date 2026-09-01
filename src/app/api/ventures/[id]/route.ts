import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { archiveReference } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ ok: archiveReference(getDb(), "venture", Number(id)) });
}
