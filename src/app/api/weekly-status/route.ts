import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { publicDatabaseError } from "@/lib/database-errors";
import { getDb } from "@/lib/db";
import { findMemberById } from "@/lib/repository";
import { currentMemberId } from "@/lib/server-access";
import { errorMessage } from "@/lib/validation";
import { weeklyStatusForMember } from "@/lib/weekly-ledger";

export async function GET(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
  try {
    const db = await getDb();
    const member = await findMemberById(db, memberId);
    if (!member) return NextResponse.json({ error: "Member access is required" }, { status: 401 });
    const week = new URL(request.url).searchParams.get("week") ?? DateTime.now().setZone(member.timezone).toISODate()!;
    return NextResponse.json({ status: await weeklyStatusForMember(db, member, week) });
  } catch (error) {
    return NextResponse.json({ error: publicDatabaseError(error, errorMessage(error)) }, { status: 400 });
  }
}
