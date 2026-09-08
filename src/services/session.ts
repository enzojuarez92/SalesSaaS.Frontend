import type { AuthResponse } from "../types/api";
export const SESSION_KEY = "salessaas.session";
export function validSession(value: unknown): value is AuthResponse {
  if (!value || typeof value !== "object") return false;
  const s = value as AuthResponse;
  return (
    [
      "accessToken",
      "refreshToken",
      "userId",
      "email",
      "tenantId",
      "role",
    ].every(
      (k) =>
        typeof s[k as keyof AuthResponse] === "string" &&
        !!s[k as keyof AuthResponse],
    ) && Date.parse(s.expiresAtUtc) > Date.now()
  );
}
export function readSession(): AuthResponse | null {
  try {
    const s: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (validSession(s)) return s;
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Invalid or unavailable storage. */
  }
  return null;
}
