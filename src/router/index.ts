import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";
import type { Subscription } from "../types/api";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "landing",
      component: () => import("../views/LandingView.vue"),
      meta: { public: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { public: true },
    },
    {
      path: "/register",
      component: () => import("../views/RegisterView.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      component: () => import("../layouts/AppLayout.vue"),
      children: [
        {
          path: "presupuestos",
          name: "quotes",
          component: () => import("../views/QuotesView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "compras",
          name: "purchases",
          component: () => import("../views/PurchasesView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        { path: "modules/compras", redirect: "/compras" },
        {
          path: "perfil",
          name: "profile",
          component: () => import("../views/ProfileView.vue"),
        },
        {
          path: "dashboard",
          name: "dashboard",
          component: () => import("../views/DashboardView.vue"),
        },
        {
          path: "ventas",
          name: "sales",
          component: () => import("../views/SalesView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "afip",
          name: "afip",
          component: () => import("../views/AfipView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "productos",
          name: "products",
          component: () => import("../views/ProductsView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "categorias",
          name: "categories",
          component: () => import("../views/CategoriesView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "cuentas-corrientes",
          name: "accounts",
          component: () => import("../views/AccountsView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "caja",
          name: "cash",
          component: () => import("../views/CashView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "depositos",
          name: "warehouses",
          component: () => import("../views/WarehousesView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "suscripcion",
          name: "subscription",
          component: () => import("../views/SubscriptionView.vue"),
        },
        {
          path: "configuracion",
          name: "settings",
          component: () => import("../views/SettingsView.vue"),
        },
        {
          path: "reportes",
          name: "reports",
          component: () => import("../views/ReportsView.vue"),
          meta: { requiresActiveSubscription: true },
        },
        {
          path: "modules/:module",
          component: () => import("../views/ModuleView.vue"),
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    auth.clear();
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  if (to.meta.public && auth.isAuthenticated) return "/dashboard";
  if (to.meta.requiresActiveSubscription && auth.tenantId) {
    try {
      const { data } = await api.get<Subscription | null>("/subscription/current", { params: { tenantId: auth.tenantId } });
      const isActive = !!data && [1, 4].includes(data.status) && Date.parse(data.expiresAtUtc) > Date.now();
      if (!isActive) return { path: "/suscripcion", query: { expired: data?.status === 4 ? "trial" : "plan" } };
    } catch {
      return { path: "/suscripcion", query: { expired: "plan" } };
    }
  }
});
export function safeRedirect(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login") &&
    !value.startsWith("/register")
    ? value
    : "/dashboard";
}
