import { afterEach, describe, expect, it } from "vitest";
import { AgentAuthError, requireAgentToken } from "./agent-auth";

describe("agent bearer authentication", () => {
  afterEach(() => { delete process.env.AGENT_API_TOKEN; });

  it("distinguishes disabled, invalid, and valid access", () => {
    const request = (token?: string) => new Request("https://example.test/api", { headers: token ? { authorization: `Bearer ${token}` } : {} });

    expect(() => requireAgentToken(request())).toThrowError(new AgentAuthError("Agent access is not enabled", 503));
    process.env.AGENT_API_TOKEN = "correct-secret";
    expect(() => requireAgentToken(request("wrong-secret"))).toThrowError(new AgentAuthError("A valid agent token is required", 401));
    expect(() => requireAgentToken(request("correct-secret"))).not.toThrow();
  });
});
