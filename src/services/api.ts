import axios, { type InternalAxiosRequestConfig } from "axios";
import type { AuthResponse } from "../types/api";
import { readSession, writeSession } from "./session";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
});
type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
const refreshBeforeExpirationMs = 60_000;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let expirationNotified = false;

async function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  const session = readSession();
  if (!session) return null;
  refreshInFlight = api
    .post<AuthResponse>("/auth/refresh", { refreshToken: session.refreshToken })
    .then(({ data }) => {
      writeSession(data);
      expirationNotified = false;
      window.dispatchEvent(new CustomEvent<AuthResponse>("auth:refreshed", { detail: data }));
      return data;
    })
    .catch(() => null)
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
function notifyExpiration() {
  if (expirationNotified) return;
  expirationNotified = true;
  window.dispatchEvent(new Event("auth:expired"));
}

api.interceptors.request.use(async (config) => {
  if (!config.url?.startsWith("/auth/")) {
    let session = readSession();
    if (session && Date.parse(session.expiresAtUtc) - Date.now() <= refreshBeforeExpirationMs)
      session = (await refreshSession()) || session;
    if (session) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
      const warehouseId = sessionStorage.getItem(
        `salessaas.warehouse.${session.tenantId}`,
      );
      if (warehouseId) config.headers["X-Warehouse-Id"] = warehouseId;
    }
  }
  return config;
});
export function notify(message: string, error = false) {
  window.dispatchEvent(
    new CustomEvent("app:toast", { detail: { message, error } }),
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as RetriableRequest | undefined;
    if (error.response?.status === 401 && request && !request._retry && !request.url?.startsWith("/auth/")) {
      request._retry = true;
      const session = await refreshSession();
      if (session) return api.request(request);
      notifyExpiration();
    }
    return Promise.reject(error);
  },
);
export function apiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "No se pudo completar la operación.";
  if (error.code === "ERR_NETWORK" || !error.response)
    return "No pudimos conectar con el servidor. Verificá que los servicios estén disponibles y volvé a intentar.";
  const data = error.response?.data;
  if (error.response?.status === 403)
    return data?.detail || "No tenés permisos para acceder a esta información.";
  if (error.response?.status === 401)
    return data?.detail || "Tu sesión venció. Iniciá sesión nuevamente.";
  if (error.response?.status === 402)
    return data?.detail || "Revisá el estado de tu suscripción.";
  if (error.response?.status === 429)
    return "Demasiados intentos. Esperá un minuto y volvé a intentar.";
  if (data?.errors) return Object.values(data.errors).flat().join(" ");
  return (
    data?.message ||
    data?.error ||
    data?.detail ||
    "No pudimos conectar con el servidor. Verificá tu conexión e intentá nuevamente."
  );
}
