<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Building2, LayoutDashboard, Layers, LogOut, ShieldCheck } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";

const route = useRoute(), router = useRouter(), auth = useAuthStore(), tenant = useTenantStore();
const nav = [
  { label: "Resumen", path: "/admin", icon: LayoutDashboard },
  { label: "Empresas", path: "/admin/empresas", icon: Building2 },
];
const userInitials = computed(() => auth.user?.email.slice(0, 2).toUpperCase() || "SA");
async function logout() {
  const pending = auth.logout();
  tenant.reset();
  await router.replace("/login");
  await pending;
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <RouterLink class="admin-brand" to="/admin"><Layers :size="27" />SalesSaaS<span>.</span></RouterLink>
      <div class="admin-label"><ShieldCheck :size="17" /><span>SUPERADMIN</span></div>
      <nav aria-label="Administración global">
        <RouterLink v-for="item in nav" :key="item.path" :to="item.path" class="admin-nav" :class="{ active: route.path === item.path }">
          <component :is="item.icon" :size="19" />{{ item.label }}
        </RouterLink>
      </nav>
      <button class="admin-logout" @click="logout"><LogOut :size="18" />Cerrar sesión</button>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar"><div><span>Administración de plataforma</span><strong>Panel global</strong></div><div class="admin-avatar">{{ userInitials }}</div></header>
      <main class="admin-content"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell{display:flex;min-height:100vh;background:#f8fafc}.admin-sidebar{position:fixed;inset:0 auto 0 0;display:flex;flex-direction:column;width:15rem;padding:1.6rem 1rem;background:#111c32;color:#d8e2f0}.admin-brand{display:flex;align-items:center;gap:.55rem;padding:.45rem;color:#fff;font-size:1.35rem;font-weight:800}.admin-brand svg,.admin-brand span{color:#f472b6}.admin-label{display:flex;align-items:center;gap:.45rem;margin:2rem .5rem .7rem;color:#f9a8d4;font-size:.67rem;font-weight:800;letter-spacing:.12em}.admin-nav{display:flex;align-items:center;gap:.75rem;margin:.2rem 0;padding:.75rem .85rem;border-radius:.65rem;color:#b9c8da;font-size:.88rem;font-weight:650}.admin-nav:hover,.admin-nav.active{background:#2a2945;color:#fff}.admin-nav.active{box-shadow:inset 3px 0 #ec4899}.admin-logout{display:flex;align-items:center;gap:.6rem;margin-top:auto;padding:.7rem .85rem;border:0;border-radius:.65rem;background:transparent;color:#b9c8da;font-weight:650;cursor:pointer}.admin-logout:hover{background:#243047;color:#fff}.admin-main{width:calc(100% - 15rem);margin-left:15rem}.admin-topbar{display:flex;align-items:center;justify-content:space-between;height:4.8rem;padding:0 2rem;border-bottom:1px solid #e2e8f0;background:#fff}.admin-topbar span,.admin-topbar strong{display:block}.admin-topbar span{color:#64748b;font-size:.76rem}.admin-topbar strong{margin-top:.15rem;color:#0f172a;font-size:.94rem}.admin-avatar{display:grid;place-items:center;width:2.3rem;height:2.3rem;border-radius:50%;background:#fce7f3;color:#be185d;font-size:.75rem;font-weight:800}.admin-content{padding:2rem;max-width:100rem}.dark .admin-shell{background:#0f172a}.dark .admin-topbar{border-color:#334155;background:#18233a}.dark .admin-topbar strong{color:#f8fafc}.dark .admin-topbar span{color:#b8c7dc}@media(max-width:720px){.admin-sidebar{position:static;width:100%;min-height:auto;padding:.8rem;flex-direction:row;align-items:center;gap:.5rem}.admin-label,.admin-logout{display:none}.admin-sidebar nav{display:flex;gap:.3rem;margin-left:auto}.admin-nav{margin:0}.admin-nav :deep(svg){display:none}.admin-main{width:100%;margin:0}.admin-shell{display:block}.admin-topbar{padding:0 1rem}.admin-content{padding:1.2rem}}
</style>
