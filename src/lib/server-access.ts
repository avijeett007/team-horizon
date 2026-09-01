import { cookies } from "next/headers";
import { isAdminToken, readMemberToken } from "./auth";

export const MEMBER_COOKIE = "team_member";
export const ADMIN_COOKIE = "team_admin";

export async function currentMemberId(): Promise<number | null> {
  const store = await cookies();
  return readMemberToken(store.get(MEMBER_COOKIE)?.value);
}

export async function hasAdminAccess(): Promise<boolean> {
  const store = await cookies();
  return isAdminToken(store.get(ADMIN_COOKIE)?.value);
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});
