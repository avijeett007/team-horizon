import crypto from "node:crypto";

export class AgentAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AgentAuthError";
  }
}

export function requireAgentToken(request: Request): void {
  const expected = process.env.AGENT_API_TOKEN;
  if (!expected) throw new AgentAuthError("Agent access is not enabled", 503);
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new AgentAuthError("A valid agent token is required", 401);
  }
}
