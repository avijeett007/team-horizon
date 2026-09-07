import { NextResponse } from "next/server";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { createProject } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, projectInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try {
    const db = await getDb();
    return NextResponse.json({ project: await createProject(db, projectInputSchema.parse(await request.json())) }, { status: 201 });
  }
  catch (error) { return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: 400 }); }
}
