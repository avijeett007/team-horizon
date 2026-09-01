import { beforeEach, describe, expect, it } from "vitest";
import { isAdminToken, readMemberToken, signAdminToken, signMemberToken, verifyAdminPin } from "./auth";

describe("signed access tokens", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "a-test-secret-that-is-long-enough";
    process.env.ADMIN_PIN = "493827";
  });

  it("round-trips a member id", () => {
    expect(readMemberToken(signMemberToken(42), Date.now())).toBe(42);
  });

  it("rejects a tampered member token", () => {
    const token = signMemberToken(42);
    expect(readMemberToken(`${token.slice(0, -1)}x`, Date.now())).toBeNull();
  });

  it("rejects an expired member token", () => {
    const now = Date.now();
    expect(readMemberToken(signMemberToken(42, now - 31 * 86_400_000), now)).toBeNull();
  });

  it("accepts only the configured admin pin and a valid admin token", () => {
    expect(verifyAdminPin("493827")).toBe(true);
    expect(verifyAdminPin("000000")).toBe(false);
    expect(isAdminToken(signAdminToken(), Date.now())).toBe(true);
  });
});
