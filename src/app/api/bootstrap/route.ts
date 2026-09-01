import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { findMemberById, listBootstrap } from "@/lib/repository";
import { currentMemberId, hasAdminAccess } from "@/lib/server-access";

export async function GET() {
  const db = getDb();
  const memberId = await currentMemberId();
  const admin = await hasAdminAccess();
  return NextResponse.json({ ...listBootstrap(db, admin), sessionMember: memberId ? findMemberById(db, memberId) : null, admin });
}
