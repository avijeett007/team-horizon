import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createEntries, listEntries } from "@/lib/repository";
import { currentMemberId } from "@/lib/server-access";
import { entryInputSchema, errorMessage } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) throw new Error("A start and end date are required");
    const members = url.searchParams.getAll("member").map(Number).filter(Number.isFinite);
    return NextResponse.json({ entries: listEntries(getDb(), from, to, members) });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}

export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Enter your team email before adding availability" }, { status: 401 });
  try {
    const input = entryInputSchema.parse(await request.json());
    return NextResponse.json({ entries: createEntries(getDb(), memberId, input) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 400 }); }
}
