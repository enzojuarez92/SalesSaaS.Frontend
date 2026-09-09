import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
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
          path: "",
          name: "dashboard",
          component: () => import("../views/DashboardView.vue"),
        },
        {
          path: "ventas",
          name: "sales",
          component: () => import("../views/SalesView.vue"),
        },
        {
          path: "afip",
          name: "afip",
          component: () => import("../views/AfipView.vue"),
        },
        {
          path: "productos",
          name: "products",
          component: () => import("../views/ProductsView.vue"),
        },
        {
          path: "cuentas-corrientes",
          name: "accounts",
          component: () => import("../views/AccountsView.vue"),
        },
        { path: "caja", name: "cash", component: () => import("../views/CashView.vue") },
        { path: "depositos", name: "warehouses", component: () => import("../views/WarehousesView.vue") },
        { path: "suscripcion", name: "subscription", component: () => import("../views/SubscriptionView.vue") },
        { path: "configuracion", name: "settings", component: () => import("../views/SettingsView.vue") },
        { path: "reportes", name: "reports", component: () => import("../views/ReportsView.vue") },
        {
          path: "modules/:module",
          component: () => import("../views/ModuleView.vue"),
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    auth.clear();
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  if (to.meta.public && auth.isAuthenticated && !to.query.switch) return "/";
});
export function safeRedirect(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login") &&
    !value.startsWith("/register")
    ? value
    : "/";
}
