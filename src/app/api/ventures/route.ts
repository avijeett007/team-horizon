import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createVenture } from "@/lib/repository";
import { hasAdminAccess } from "@/lib/server-access";
import { errorMessage, ventureInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await hasAdminAccess())) return NextResponse.json({ error: "Admin access is required" }, { status: 401 });
  try { return NextResponse.json({ venture: createVenture(getDb(), ventureInputSchema.parse(await request.json())) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}
