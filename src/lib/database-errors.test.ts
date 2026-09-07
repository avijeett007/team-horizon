import { describe, expect, it } from "vitest";
import { isUniqueViolation, publicDatabaseError } from "./database-errors";

describe("PostgreSQL error handling", () => {
  it("recognises a duplicate-key violation by SQLSTATE", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("never exposes connection details or credentials", () => {
    const message = publicDatabaseError(new Error("connect ECONNREFUSED password=secret"));
    expect(message).toBe("Database service is unavailable");
    expect(message).not.toContain("secret");
  });

  it("preserves safe application validation errors", () => {
    expect(publicDatabaseError(new Error("projectId is required"))).toBe("projectId is required");
  });
});
