<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Building2, CircleDollarSign, RefreshCw, Sparkles, UsersRound } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { money } from "../services/format";
import type { AdminDashboard } from "../types/api";

const summary = ref<AdminDashboard | null>(null), loading = ref(false), error = ref("");
const cards = computed(() => !summary.value ? [] : [
  { label: "Empresas registradas", value: summary.value.registeredTenants.toLocaleString("es-AR"), detail: "Negocios dados de alta", icon: Building2, tone: "pink" },
  { label: "Suscripciones activas", value: summary.value.activeSubscriptions.toLocaleString("es-AR"), detail: "Clientes con plan pago", icon: UsersRound, tone: "green" },
  { label: "Pruebas en curso", value: summary.value.trialingTenants.toLocaleString("es-AR"), detail: "Cuentas en período trial", icon: Sparkles, tone: "violet" },
  { label: "Facturación estimada del mes", value: money(summary.value.estimatedMonthlyRevenue), detail: "Estimación sobre planes activos", icon: CircleDollarSign, tone: "orange" },
]);
async function load() { loading.value = true; error.value = ""; try { summary.value = (await api.get<AdminDashboard>("/admin/dashboard")).data; } catch (cause) { error.value = apiError(cause); } finally { loading.value = false; } }
onMounted(load);
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">SuperAdmin / Resumen</div><h1>Panel de control</h1><p>Visión global de empresas, suscripciones y facturación de la plataforma.</p></div><button class="secondary" :disabled="loading" @click="load"><RefreshCw :size="16" :class="{ spin: loading }" />Actualizar</button></div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div v-else-if="loading && !summary" class="admin-kpis" aria-busy="true"><div v-for="i in 4" :key="i" class="admin-kpi skeleton"><div></div><div></div></div></div>
  <section v-else-if="summary" class="admin-kpis"><article v-for="card in cards" :key="card.label" class="admin-kpi" :class="card.tone"><div class="admin-kpi-icon"><component :is="card.icon" :size="21" /></div><p>{{ card.label }}</p><strong>{{ card.value }}</strong><small>{{ card.detail }}</small></article></section>
</template>

<style scoped>
.admin-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}.admin-kpi{min-height:10rem;padding:1.2rem;border:1px solid #e2e8f0;border-top:3px solid #ec4899;border-radius:1rem;background:#fff}.admin-kpi.green{border-top-color:#10b981}.admin-kpi.violet{border-top-color:#8b5cf6}.admin-kpi.orange{border-top-color:#f97316}.admin-kpi-icon{display:grid;place-items:center;width:2.5rem;height:2.5rem;margin-bottom:1rem;border-radius:.7rem;background:#fdf2f8;color:#ec4899}.green .admin-kpi-icon{background:#ecfdf5;color:#059669}.violet .admin-kpi-icon{background:#f5f3ff;color:#7c3aed}.orange .admin-kpi-icon{background:#fff7ed;color:#ea580c}.admin-kpi p{margin:0;color:#64748b;font-size:.82rem}.admin-kpi strong{display:block;margin:.35rem 0 .55rem;color:#0f172a;font-size:1.75rem}.admin-kpi small{color:#94a3b8}.skeleton{min-height:10rem;background:linear-gradient(90deg,#f1f5f9,#fff,#f1f5f9);animation:pulse 1.4s infinite}@keyframes pulse{50%{opacity:.55}}.dark .admin-kpi{border-color:#334155;background:#18233a}.dark .admin-kpi strong{color:#f8fafc}.dark .admin-kpi p{color:#b8c7dc}@media(max-width:1000px){.admin-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.admin-kpis{grid-template-columns:1fr}}
</style>
