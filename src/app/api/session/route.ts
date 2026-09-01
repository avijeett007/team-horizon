import { NextResponse } from "next/server";
import { z } from "zod";
import { signMemberToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { findMemberByEmail } from "@/lib/repository";
import { cookieOptions, MEMBER_COOKIE } from "@/lib/server-access";

export async function POST(request: Request) {
  const parsed = z.object({ email: z.email() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const member = findMemberByEmail(getDb(), parsed.data.email);
  if (!member) return NextResponse.json({ error: "That email is not on the team list yet. Ask an administrator to add it." }, { status: 404 });
  const response = NextResponse.json({ member });
  response.cookies.set(MEMBER_COOKIE, signMemberToken(member.id), cookieOptions(30 * 86_400));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(MEMBER_COOKIE, "", cookieOptions(0));
  return response;
}
