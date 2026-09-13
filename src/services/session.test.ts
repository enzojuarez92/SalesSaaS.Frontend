import { describe, expect, it } from "vitest";
import { hasValidAccessToken, validSession } from "./session";
describe("session validation", () => {
  const session = {
    accessToken: "token",
    refreshToken: "refresh",
    userId: "user",
    email: "a@b.com",
    tenantId: "tenant",
    role: "Owner",
    expiresAtUtc: new Date(Date.now() + 60000).toISOString(),
    refreshTokenExpiresAtUtc: new Date(Date.now() + 86400000).toISOString(),
  };
  it("accepts a complete unexpired session", () =>
    expect(validSession(session)).toBe(true));
  it("keeps an expired access token while its refresh token remains valid", () => {
    const expiredAccess = { ...session, expiresAtUtc: "2000-01-01" };
    expect(validSession(expiredAccess)).toBe(true);
    expect(hasValidAccessToken(expiredAccess)).toBe(false);
  });
  it("rejects expired refresh tokens, malformed, or incomplete sessions", () => {
    for (const value of [
      null,
      {},
      { ...session, tenantId: "" },
      { ...session, refreshTokenExpiresAtUtc: "invalid" },
      { ...session, refreshTokenExpiresAtUtc: "2000-01-01" },
    ])
      expect(validSession(value)).toBe(false);
  });
});
