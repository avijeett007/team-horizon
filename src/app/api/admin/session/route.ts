import { NextResponse } from "next/server";
import { signAdminToken, verifyAdminPin } from "@/lib/auth";
import { ADMIN_COOKIE, cookieOptions } from "@/lib/server-access";

export async function POST(request: Request) {
  const body = await request.json();
  if (typeof body.pin !== "string" || !verifyAdminPin(body.pin)) return NextResponse.json({ error: "The admin PIN is not correct" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, signAdminToken(), cookieOptions(12 * 3_600));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
  return response;
}
