<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Layers,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Wallet,
  BarChart3,
  CreditCard,
  Bell,
  Search,
  Menu,
  PanelLeftClose,
  LogOut,
  ChevronDown,
  X,
  Building2,
  Check,
  Boxes,
  ContactRound,
} from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import { api, apiError } from "../services/api";
import type { Notification } from "../types/api";
const auth = useAuthStore(),
  tenant = useTenantStore(),
  route = useRoute(),
  router = useRouter();
const collapsed = ref(false),
  mobile = ref(false),
  search = ref(""),
  notificationsOpen = ref(false),
  profileOpen = ref(false);
const notifications = ref<Notification[]>([]),
  notificationError = ref(""),
  notificationLoading = ref(false);
const nav = [
  { name: "Resumen", path: "/", icon: LayoutDashboard },
  { name: "Ventas / POS", path: "/ventas", icon: ShoppingCart },
  { name: "Productos", path: "/productos", icon: Boxes },
  { name: "Depósitos", path: "/depositos", icon: Building2 },
  {
    name: "Cuentas corrientes",
    path: "/cuentas-corrientes",
    icon: ContactRound,
  },
  { name: "Facturación AFIP", path: "/afip", icon: Receipt },
  { name: "Compras", path: "/modules/compras", icon: Package },
  { name: "Caja", path: "/caja", icon: Wallet },
  { name: "Reportes", path: "/reportes", icon: BarChart3 },
  { name: "Suscripción", path: "/suscripcion", icon: CreditCard },
  { name: "Configuración", path: "/configuracion", icon: Building2 },
];
const filtered = computed(() =>
  nav.filter((n) => n.name.toLowerCase().includes(search.value.toLowerCase())),
);
watch(
  () => auth.tenantId,
  () => {
    notifications.value = [];
    void tenant.load();
  },
  { immediate: true },
);
watch(
  () => route.fullPath,
  () => {
    mobile.value = false;
    search.value = "";
    profileOpen.value = false;
  },
);
async function loadNotifications() {
  notificationsOpen.value = !notificationsOpen.value;
  if (!notificationsOpen.value) return;
  notificationError.value = "";
  notificationLoading.value = true;
  try {
    notifications.value = (
      await api.get<Notification[]>("/notifications")
    ).data;
  } catch (e) {
    notificationError.value = apiError(e);
  } finally {
    notificationLoading.value = false;
  }
}
async function markRead(n: Notification) {
  try {
    await api.post(`/notifications/${n.id}/read`);
    n.isRead = true;
  } catch (e) {
    notificationError.value = apiError(e);
  }
}
async function logout() {
  const pending = auth.logout();
  tenant.reset();
  await router.replace("/login");
  await pending;
}
</script>
<template>
  <div
    class="app-shell"
    :class="{ collapsed }"
    @keydown.esc="
      mobile = false;
      notificationsOpen = false;
      profileOpen = false;
      search = '';
    "
  >
    <button
      v-if="mobile"
      class="sidebar-overlay"
      aria-label="Cerrar menú"
      @click="mobile = false"
    ></button>
    <aside class="sidebar" :class="{ 'mobile-open': mobile }">
      <RouterLink to="/" class="brand"
        ><Layers :size="29" /><span class="sidebar-label"
          >SalesSaaS<span class="brand-dot">.</span></span
        ></RouterLink
      >
      <div class="workspace">
        <div class="workspace-icon">S</div>
        <div class="sidebar-label">
          <strong>Mi espacio de trabajo</strong
          ><small>Gestión empresarial</small>
        </div>
      </div>
      <p class="nav-caption sidebar-label">PRINCIPAL</p>
      <nav aria-label="Navegación principal">
        <RouterLink
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          :title="item.name"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          ><component :is="item.icon" :size="20" /><span
            class="sidebar-label"
            >{{ item.name }}</span
          ></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <div class="plan-card sidebar-label">
          <span class="badge">TU PLAN</span
          ><strong>{{
            tenant.subscription?.planName || "Mi suscripción"
          }}</strong>
          <p>Un lugar para hacer crecer tu negocio.</p>
          <RouterLink to="/suscripcion">Ver suscripción →</RouterLink>
        </div>
        <button
          class="nav-item collapse-button"
          @click="collapsed = !collapsed"
          :aria-label="collapsed ? 'Expandir menú' : 'Contraer menú'"
        >
          <PanelLeftClose :size="20" /><span class="sidebar-label"
            >Contraer menú</span
          >
        </button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <button
          class="icon-button mobile-toggle"
          aria-label="Abrir menú"
          @click="mobile = true"
        >
          <Menu />
        </button>
        <div class="tenant-picker">
          <Building2 :size="19" />
          <div>
            <span class="hint">NEGOCIO ACTIVO</span
            ><button
              class="tenant-link"
              @click="router.push('/login?switch=1')"
              :title="auth.tenantId"
            >
              {{ auth.tenantId.slice(0, 8) }}…<ChevronDown :size="14" />
            </button>
          </div>
        </div>
        <label class="warehouse-picker"
          ><span class="sr-only">Sucursal / depósito activo</span
          ><select v-model="tenant.activeWarehouseId">
            <option value="">Todas las sucursales</option>
            <option v-for="w in tenant.warehouses" :key="w.id" :value="w.id">
              {{ w.name }}
            </option>
          </select></label
        >
        <div class="topbar-spacer"></div>
        <div class="quick-search">
          <Search :size="17" /><input
            v-model="search"
            aria-label="Buscar módulo"
            placeholder="Buscar módulo…"
          />
          <div v-if="search" class="popover search-results">
            <RouterLink
              v-for="item in filtered"
              :key="item.path"
              :to="item.path"
              >{{ item.name }}</RouterLink
            >
            <p v-if="!filtered.length">No encontramos módulos.</p>
          </div>
        </div>
        <div class="popover-anchor">
          <button
            class="icon-button notification-button"
            aria-label="Notificaciones"
            :aria-expanded="notificationsOpen"
            @click="loadNotifications"
          >
            <Bell :size="20" />
          </button>
          <section v-if="notificationsOpen" class="popover notification-panel">
            <div class="section-heading">
              <h3>Notificaciones</h3>
              <button
                class="icon-button"
                aria-label="Cerrar notificaciones"
                @click="notificationsOpen = false"
              >
                <X :size="16" />
              </button>
            </div>
            <p v-if="notificationLoading" role="status">Cargando…</p>
            <p v-else-if="notificationError" class="error" role="alert">
              {{ notificationError }}
            </p>
            <p v-else-if="!notifications.length" class="empty-small">
              Todavía no tenés notificaciones.
            </p>
            <article
              v-for="n in notifications"
              :key="n.id"
              class="notification"
            >
              <strong>{{ n.title }}</strong>
              <p>{{ n.message }}</p>
              <button v-if="!n.isRead" class="text-button" @click="markRead(n)">
                <Check :size="14" /> Marcar como leída
              </button>
            </article>
          </section>
        </div>
        <div class="popover-anchor">
          <button
            class="avatar"
            aria-label="Abrir perfil"
            :aria-expanded="profileOpen"
            @click="profileOpen = !profileOpen"
          >
            {{ auth.user?.email.slice(0, 2).toUpperCase() }}
          </button>
          <div v-if="profileOpen" class="popover profile-panel">
            <strong>{{ auth.user?.email }}</strong>
            <p>{{ auth.user?.role }}</p>
            <button class="text-button" @click="logout">
              <LogOut :size="16" />Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main class="page-content">
        <p v-if="tenant.error" class="notice" role="status">
          {{ tenant.error }}
        </p>
        <RouterView />
      </main>
      <footer class="app-footer">
        SalesSaaS <span>Hecho para acompañar tu crecimiento.</span>
      </footer>
    </div>
  </div>
</template>
