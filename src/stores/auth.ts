import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../services/api";
import { clearImpersonatorSession, hasValidAccessToken, readImpersonatorSession, readSession, SESSION_KEY, writeImpersonatorSession, writeSession } from "../services/session";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../types/api";
export const useAuthStore = defineStore("auth", () => {
  const session = ref<AuthResponse | null>(readSession());
  const isAuthenticated = computed(
    () => hasValidAccessToken(session.value),
  );
  const user = computed(() =>
    session.value
      ? {
          id: session.value.userId,
          email: session.value.email,
          role: session.value.role,
        }
      : null,
  );
  const tenantId = computed(() => session.value?.tenantId || "");
  const isImpersonating = computed(() => !!session.value?.supportImpersonationLogId);
  function clear() {
    session.value = null;
    localStorage.removeItem(SESSION_KEY);
    clearImpersonatorSession();
  }
  function setSession(value: AuthResponse) {
    writeSession(value);
    session.value = value;
  }
  async function refresh() {
    const current = session.value || readSession();
    if (!current) return false;
    try {
      const { data } = await api.post<AuthResponse>("/auth/refresh", { refreshToken: current.refreshToken });
      setSession(data);
      return true;
    } catch {
      return false;
    }
  }
  async function authenticate(
    path: "login" | "register" | "register-tenant",
    payload: LoginRequest | RegisterRequest,
  ) {
    const { data } = await api.post<AuthResponse>(`/auth/${path}`, payload);
    clearImpersonatorSession();
    setSession(data);
  }
  function beginImpersonation(value: AuthResponse) {
    if (!session.value || session.value.role !== "SuperAdmin" || !value.supportImpersonationLogId)
      throw new Error("No se pudo iniciar la sesión de soporte.");
    writeImpersonatorSession(session.value);
    setSession(value);
  }
  async function endImpersonation() {
    const backup = readImpersonatorSession();
    try {
      await api.post("/impersonation/stop");
    } catch {
      // We still restore the administrator session. The API also invalidates expired support sessions.
    }
    clearImpersonatorSession();
    if (!backup) {
      clear();
      return false;
    }
    try {
      const { data } = await api.post<AuthResponse>("/auth/refresh", { refreshToken: backup.refreshToken });
      setSession(data);
      return true;
    } catch {
      clear();
      return false;
    }
  }
  async function logout() {
    const refreshToken = session.value?.refreshToken;
    clear();
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refreshToken });
      } catch {
        /* Local session has already ended. */
      }
    }
  }
  return {
    session,
    user,
    tenantId,
    isImpersonating,
    isAuthenticated,
    clear,
    setSession,
    refresh,
    authenticate,
    beginImpersonation,
    endImpersonation,
    logout,
  };
});
