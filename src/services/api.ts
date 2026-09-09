import axios from "axios";
import { readSession } from "./session";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
});
api.interceptors.request.use((config) => {
  if (!config.url?.startsWith("/auth/")) {
    const session = readSession();
    if (session) config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.startsWith("/auth/")
    )
      window.dispatchEvent(new Event("auth:expired"));
    return Promise.reject(error);
  },
);
export function apiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "No se pudo completar la operación.";
  if (error.code === "ERR_NETWORK" || !error.response)
    return "No pudimos conectar con el backend en http://localhost:5274. Iniciá SalesSaaS.Backend y volvé a intentar.";
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
    data?.detail ||
    "No pudimos conectar con el servidor. Verificá tu conexión e intentá nuevamente."
  );
}
