import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../services/api";
import { hasValidAccessToken, readSession, SESSION_KEY, writeSession } from "../services/session";
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
  function clear() {
    session.value = null;
    localStorage.removeItem(SESSION_KEY);
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
    setSession(data);
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
    isAuthenticated,
    clear,
    setSession,
    refresh,
    authenticate,
    logout,
  };
});
