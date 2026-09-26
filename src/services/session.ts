import type { AuthResponse } from "../types/api";
export const SESSION_KEY = "klovercloud.session";
export const IMPERSONATOR_SESSION_KEY = "klovercloud.impersonator-session";
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
    ) && Date.parse(s.refreshTokenExpiresAtUtc) > Date.now()
  );
}
export const hasValidAccessToken = (session: AuthResponse | null) =>
  !!session && Date.parse(session.expiresAtUtc) > Date.now();
export function writeSession(session: AuthResponse) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
export function writeImpersonatorSession(session: AuthResponse) {
  localStorage.setItem(IMPERSONATOR_SESSION_KEY, JSON.stringify(session));
}
export function readImpersonatorSession(): AuthResponse | null {
  try {
    const session: unknown = JSON.parse(localStorage.getItem(IMPERSONATOR_SESSION_KEY) || "null");
    if (validSession(session)) return session;
  } catch {
    // A corrupt backup cannot be used to restore an administrator session.
  }
  localStorage.removeItem(IMPERSONATOR_SESSION_KEY);
  return null;
}
export function clearImpersonatorSession() {
  localStorage.removeItem(IMPERSONATOR_SESSION_KEY);
}
