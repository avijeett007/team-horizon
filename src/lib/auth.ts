import crypto from "node:crypto";

const MEMBER_MAX_AGE_MS = 30 * 86_400_000;
const ADMIN_MAX_AGE_MS = 12 * 3_600_000;

function secret(): string {
  const value = process.env.SESSION_SECRET ?? process.env.ADMIN_PIN;
  if (!value) throw new Error("SESSION_SECRET or ADMIN_PIN must be configured");
  return value;
}

function signature(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function sign(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

function read(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;
  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function signMemberToken(memberId: number, issuedAt = Date.now()): string {
  return sign({ kind: "member", memberId, issuedAt });
}

export function readMemberToken(token: string | undefined, now = Date.now()): number | null {
  const payload = read(token);
  if (!payload || payload.kind !== "member" || typeof payload.memberId !== "number" || typeof payload.issuedAt !== "number") return null;
  if (now - payload.issuedAt > MEMBER_MAX_AGE_MS || payload.issuedAt > now + 60_000) return null;
  return payload.memberId;
}

export function signAdminToken(issuedAt = Date.now()): string {
  return sign({ kind: "admin", issuedAt });
}

export function isAdminToken(token: string | undefined, now = Date.now()): boolean {
  const payload = read(token);
  return Boolean(payload?.kind === "admin" && typeof payload.issuedAt === "number" && now - payload.issuedAt <= ADMIN_MAX_AGE_MS);
}

export function verifyAdminPin(pin: string): boolean {
  const configured = process.env.ADMIN_PIN;
  if (!configured) return false;
  const supplied = Buffer.from(pin);
  const expected = Buffer.from(configured);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
