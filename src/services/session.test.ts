import { describe, expect, it } from "vitest";
import { validSession } from "./session";
describe("session validation", () => {
  const session = {
    accessToken: "token",
    refreshToken: "refresh",
    userId: "user",
    email: "a@b.com",
    tenantId: "tenant",
    role: "Owner",
    expiresAtUtc: new Date(Date.now() + 60000).toISOString(),
  };
  it("accepts a complete unexpired session", () =>
    expect(validSession(session)).toBe(true));
  it("rejects expired, malformed, or incomplete sessions", () => {
    for (const value of [
      null,
      {},
      { ...session, tenantId: "" },
      { ...session, expiresAtUtc: "invalid" },
      { ...session, expiresAtUtc: "2000-01-01" },
    ])
      expect(validSession(value)).toBe(false);
  });
});
