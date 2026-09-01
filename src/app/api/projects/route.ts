import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createProject } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, projectInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try { return NextResponse.json({ project: createProject(getDb(), projectInputSchema.parse(await request.json())) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}
