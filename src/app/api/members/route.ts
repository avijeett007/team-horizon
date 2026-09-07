import { NextResponse } from "next/server";
import { isUniqueViolation, publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { createMember } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, memberInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const input = memberInputSchema.parse(await request.json());
    const db = await getDb();
    return NextResponse.json({ member: await createMember(db, input) }, { status: 201 });
  } catch (error) {
    const message = isUniqueViolation(error) ? "That email is already on the team list" : publicDatabaseError(error, errorMessage(error));
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
