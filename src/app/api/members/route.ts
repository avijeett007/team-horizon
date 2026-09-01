import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createMember } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, memberInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const input = memberInputSchema.parse(await request.json());
    return NextResponse.json({ member: createMember(getDb(), input) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "That email is already on the team list" : errorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
