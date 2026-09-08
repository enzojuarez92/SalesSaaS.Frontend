<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Wallet,
  TrendingUp,
  Receipt,
  RefreshCw,
  ArrowRight,
  Package,
  ShieldCheck,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import type { DashboardKpis, TopProduct } from "../types/api";
const auth = useAuthStore();
const date = ref(new Date().toISOString().slice(0, 10)),
  data = ref<DashboardKpis | null>(null),
  products = ref<TopProduct[]>([]);
const loading = ref(false),
  error = ref(""),
  productsError = ref("");
const allowed = computed(() =>
  ["Owner", "Admin"].includes(auth.user?.role || ""),
);
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
const cards = computed(() =>
  data.value
    ? [
        {
          name: "Ventas del día",
          value: money(data.value.dailySales.current),
          variation: data.value.dailySales.variationPercentage,
          caption: "vs. día anterior",
          icon: ShoppingBag,
        },
        {
          name: "Ventas del mes",
          value: money(data.value.monthlySales.current),
          variation: data.value.monthlySales.variationPercentage,
          caption: "vs. mes anterior",
          icon: Wallet,
        },
        {
          name: "Ganancia bruta estimada",
          value: money(data.value.estimatedGrossProfit),
          variation: null,
          caption: `${data.value.estimatedGrossMarginPercentage}% de margen estimado`,
          icon: TrendingUp,
        },
        {
          name: "Órdenes procesadas",
          value: data.value.processedOrders.toLocaleString("es-AR"),
          variation: null,
          caption: "En el mes seleccionado",
          icon: Receipt,
        },
      ]
    : [],
);
watch(
  [date, () => auth.tenantId],
  async (_, __, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    if (!allowed.value || !date.value) return;
    loading.value = true;
    error.value = "";
    productsError.value = "";
    data.value = null;
    products.value = [];
    const params = { tenantId: auth.tenantId };
    const results = await Promise.allSettled([
      api.get<DashboardKpis>("/analytics/dashboard", {
        params: { ...params, date: date.value },
        signal: controller.signal,
      }),
      api.get<TopProduct[]>("/analytics/products/top-selling", {
        params: { ...params, days: 30, take: 5 },
        signal: controller.signal,
      }),
    ]);
    if (controller.signal.aborted) return;
    const [kpis, top] = results;
    if (kpis.status === "fulfilled") data.value = kpis.value.data;
    else error.value = apiError(kpis.reason);
    if (top.status === "fulfilled") products.value = top.value.data;
    else productsError.value = apiError(top.reason);
    loading.value = false;
  },
  { immediate: true },
);
function retry() {
  window.location.reload();
}
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio <span>/</span> Resumen</div>
      <h1>Todo lo que necesitás saber<span class="brand-dot">.</span></h1>
      <p>Una mirada clara a cómo va tu negocio.</p>
    </div>
    <label class="date-control"
      >Fecha de análisis (UTC)<input v-model="date" type="date" required
    /></label>
  </div>
  <div class="welcome-banner">
    <div>
      <span class="eyebrow">TU CENTRO DE CONTROL</span>
      <h2>Grandes decisiones empiezan<br />con una visión completa.</h2>
      <p>Ventas, finanzas y operación, conectadas.</p>
    </div>
    <div class="banner-symbol" aria-hidden="true">
      <TrendingUp :size="90" :stroke-width="1.2" />
    </div>
    <span class="banner-badge"
      ><ShieldCheck :size="16" /> Espacio de trabajo privado</span
    >
  </div>
  <p class="scope-note">
    Métricas de todo el negocio · importes en ARS. El selector de sucursal no
    filtra este resumen.
  </p>
  <div v-if="!allowed" class="empty-state">
    <ShieldCheck :size="36" />
    <h2>Tu espacio está listo</h2>
    <p>
      El resumen financiero está disponible para propietarios y administradores.
    </p>
  </div>
  <div
    v-else-if="loading"
    class="kpi-grid"
    aria-busy="true"
    role="status"
    aria-label="Cargando métricas"
  >
    <div v-for="i in 4" :key="i" class="kpi-card skeleton">
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
  <div v-else-if="error" class="empty-state" role="alert">
    <h2>No pudimos cargar el resumen</h2>
    <p>{{ error }}</p>
    <button class="primary" @click="retry">
      <RefreshCw :size="16" />Reintentar
    </button>
  </div>
  <template v-else-if="data"
    ><div class="kpi-grid">
      <article v-for="card in cards" :key="card.name" class="kpi-card">
        <div class="kpi-label">
          {{ card.name
          }}<span class="metric-icon"
            ><component :is="card.icon" :size="18"
          /></span>
        </div>
        <strong class="kpi-value">{{ card.value }}</strong>
        <div class="kpi-caption">
          <span
            v-if="card.variation !== null"
            class="trend"
            :class="{ negative: card.variation < 0 }"
            ><ArrowUpRight
              v-if="card.variation >= 0"
              :size="14"
            /><ArrowDownRight v-else :size="14" />{{ card.variation }}%</span
          >{{ card.caption }}
        </div>
      </article>
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Salud financiera</h2>
            <p>Los números que mueven tu negocio</p>
          </div>
          <span class="badge">RESUMEN</span>
        </div>
        <div class="finance-row">
          <span class="finance-icon green"><ArrowDownRight :size="20" /></span>
          <div>
            <strong>Cuentas por cobrar</strong>
            <p>Saldo total de clientes</p>
          </div>
          <strong>{{ money(data.totalReceivable) }}</strong>
        </div>
        <div class="finance-row">
          <span class="finance-icon orange"><ArrowUpRight :size="20" /></span>
          <div>
            <strong>Cuentas por pagar</strong>
            <p>Saldo total de proveedores</p>
          </div>
          <strong>{{ money(data.totalPayable) }}</strong>
        </div>
        <div class="ticket">
          <div>
            <p>Ticket promedio del mes</p>
            <strong>{{ money(data.averageTicket) }}</strong>
          </div>
          <Receipt :size="32" />
        </div>
      </section>
      <section class="panel">
        <div class="section-heading">
          <div>
            <h2>Productos más vendidos</h2>
            <p>Últimos 30 días, hasta hoy · por unidades</p>
          </div>
          <Package :size="20" class="muted" />
        </div>
        <p v-if="productsError" class="error" role="alert">
          {{ productsError }}
        </p>
        <div v-else-if="!products.length" class="empty-small">
          <Package :size="32" />
          <p>Tus productos destacados aparecerán con las primeras ventas.</p>
        </div>
        <div
          v-for="(product, i) in products"
          :key="product.productId"
          class="product-row"
        >
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <strong>{{ product.name }}</strong>
            <p>{{ product.sku }} · {{ product.quantitySold }} unidades</p>
          </div>
          <strong>{{ money(product.revenue) }}</strong>
        </div>
      </section>
    </div></template
  >
  <section class="next-section">
    <div class="section-heading">
      <h2>Tu operación, conectada</h2>
      <span class="muted">Seguí desde acá</span>
    </div>
    <div class="quick-links">
      <RouterLink to="/ventas"
        ><ShoppingBag />
        <div>
          <strong>Ventas</strong>
          <p>Pedidos y comprobantes</p>
        </div>
        <ArrowRight :size="18" /></RouterLink
      ><RouterLink to="/productos"
        ><Package />
        <div>
          <strong>Compras</strong>
          <p>Proveedores y abastecimiento</p>
        </div>
        <ArrowRight :size="18" /></RouterLink
      ><RouterLink to="/cuentas-corrientes"
        ><Wallet />
        <div>
          <strong>Caja</strong>
          <p>Movimientos y cierres</p>
        </div>
        <ArrowRight :size="18"
      /></RouterLink>
    </div>
  </section>
</template>
