import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "../services/api";
import { readSession, SESSION_KEY } from "../services/session";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../types/api";
export const useAuthStore = defineStore("auth", () => {
  const session = ref<AuthResponse | null>(readSession());
  const isAuthenticated = computed(
    () =>
      !!session.value && Date.parse(session.value.expiresAtUtc) > Date.now(),
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
  async function authenticate(
    path: "login" | "register",
    payload: LoginRequest | RegisterRequest,
  ) {
    const { data } = await api.post<AuthResponse>(`/auth/${path}`, payload);
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    session.value = data;
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
    authenticate,
    logout,
  };
});
