<script setup lang="ts">
import { money } from "../services/format";
import { computed, ref, watch } from "vue";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Box,
  CreditCard,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type {
  DashboardSalesPoint,
  DashboardSummary,
  TopProduct,
} from "../types/api";
const auth = useAuthStore();
const tenant = useTenantStore();
const summary = ref<DashboardSummary | null>(null),
  products = ref<TopProduct[]>([]),
  chart = ref<DashboardSalesPoint[]>([]);
const loading = ref(false),
  error = ref("");

const cards = computed(() =>
  !summary.value
    ? []
    : [
        {
          label: "Ventas de hoy",
          value: money(summary.value.dailySales),
          detail: `${summary.value.dailyTransactions} transacciones`,
          icon: Banknote,
          tint: "pink",
        },
        {
          label: "Ventas del mes",
          value: money(summary.value.monthlySales),
          detail: `${summary.value.monthlyTransactions} transacciones`,
          icon: TrendingUp,
          tint: "violet",
        },
        {
          label: "Cuentas corrientes",
          value: money(summary.value.totalReceivable),
          detail: "Pendiente de cobro",
          icon: CreditCard,
          tint: "orange",
        },
        {
          label: "Stock crítico",
          value: summary.value.criticalStockCount.toLocaleString("es-AR"),
          detail: "Productos para revisar",
          icon: AlertTriangle,
          tint: "rose",
        },
      ],
);
const maxChartValue = computed(() =>
  Math.max(1, ...chart.value.map((point) => point.total)),
);
const chartPoints = computed(() =>
  chart.value
    .map(
      (point, index) =>
        `${chart.value.length <= 1 ? 0 : (index / (chart.value.length - 1)) * 100},${100 - (point.total / maxChartValue.value) * 90 - 5}`,
    )
    .join(" "),
);
const chartArea = computed(() =>
  chartPoints.value ? `0,100 ${chartPoints.value} 100,100` : "",
);
const chartTotal = computed(() =>
  chart.value.reduce((total, point) => total + point.total, 0),
);
const paymentName = (method: number) =>
  ({
    1: "Efectivo",
    2: "Tarjeta",
    3: "Tarjeta",
    4: "Transferencia",
    5: "Mercado Pago",
    6: "Cta. corriente",
  })[method] || "Otro";
async function load() {
  if (!["Owner", "Admin"].includes(auth.user?.role || "")) return;
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  try {
    const params = {
      tenantId: auth.tenantId,
      warehouseId: tenant.activeWarehouseId || undefined,
    };
    const [summaryResult, productsResult, chartResult] = await Promise.all([
      api.get<DashboardSummary>("/dashboard/summary", { params }),
      api.get<TopProduct[]>("/dashboard/top-products", { params }),
      api.get<DashboardSalesPoint[]>("/dashboard/sales-chart", {
        params: { ...params, days: 30 },
      }),
    ]);
    summary.value = summaryResult.data;
    products.value = productsResult.data;
    chart.value = chartResult.data;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}
watch(() => auth.tenantId, load, { immediate: true });
watch(() => tenant.activeWarehouseId, load);
</script>
<template>
  <template v-if="['Owner', 'Admin'].includes(auth.user?.role || '')">
    <div class="page-heading">
      <div>
        <div class="breadcrumb">Tu negocio / Resumen</div>
        <h1>Resumen general<span class="brand-dot">.</span></h1>
        <p>La información clave para decidir rápido y operar mejor.</p>
      </div>
      <button class="secondary" :disabled="loading" @click="load">
        <RefreshCw :size="16" :class="{ spin: loading }" />Actualizar
      </button>
    </div>
    <div v-if="loading && !summary" class="kpi-grid" aria-busy="true">
      <div v-for="i in 4" :key="i" class="kpi-card skeleton">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
    <div v-else-if="error" class="empty-state panel" role="alert">
      <AlertTriangle :size="36" />
      <h2>No pudimos cargar el resumen</h2>
      <p>{{ error }}</p>
      <button class="primary" @click="load">
        <RefreshCw :size="16" />Reintentar
      </button>
    </div>
    <template v-else-if="summary"
      ><section class="dashboard-hero">
        <div>
          <span class="eyebrow">CENTRO DE CONTROL</span>
          <h2>Tu negocio, al día.</h2>
          <p>
            {{
              summary.dailyTransactions
                ? `Hoy registraste ${summary.dailyTransactions} venta(s).`
                : "Todavía no hay ventas registradas hoy."
            }}
          </p>
        </div>
        <RouterLink to="/ventas"
          >Ir al punto de venta <ArrowRight :size="17"
        /></RouterLink>
      </section>
      <div class="kpi-grid neon-kpis">
        <article
          v-for="card in cards"
          :key="card.label"
          class="kpi-card"
          :class="card.tint"
        >
          <div class="kpi-label">
            {{ card.label
            }}<span class="metric-icon"
              ><component :is="card.icon" :size="18"
            /></span>
          </div>
          <strong class="kpi-value">{{ card.value }}</strong>
          <p class="kpi-caption">{{ card.detail }}</p>
        </article>
      </div>
      <div class="dashboard-grid summary-grid">
        <section class="panel chart-panel">
          <div class="section-heading">
            <div>
              <h2>Ventas de los últimos 30 días</h2>
              <p>{{ money(chartTotal) }} acumulados en el período.</p>
            </div>
            <TrendingUp :size="21" class="muted" />
          </div>
          <div v-if="chart.length" class="sales-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sales-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stop-color="#ec4899" stop-opacity=".3" />
                  <stop offset="1" stop-color="#ec4899" stop-opacity="0" />
                </linearGradient>
              </defs>
              <line
                v-for="line in [20, 50, 80]"
                :key="line"
                x1="0"
                x2="100"
                :y1="line"
                :y2="line"
                class="chart-grid"
              />
              <polygon :points="chartArea" fill="url(#sales-gradient)" />
              <polyline
                :points="chartPoints"
                fill="none"
                stroke="#ec4899"
                stroke-width="2.2"
                vector-effect="non-scaling-stroke"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <div class="chart-labels">
              <span>{{
                new Date(chart[0].date + "T12:00:00").toLocaleDateString(
                  "es-AR",
                  { day: "2-digit", month: "short" },
                )
              }}</span
              ><span>Hoy</span>
            </div>
          </div>
        </section>
        <section class="panel cash-widget">
          <div class="section-heading">
            <div>
              <h2>Caja actual</h2>
              <p>
                {{
                  summary.currentCash
                    ? summary.currentCash.warehouseName
                    : "Sin turno abierto"
                }}
              </p>
            </div>
            <WalletCards :size="21" class="muted" />
          </div>
          <template v-if="summary.currentCash"
            ><strong>{{ money(summary.currentCash.expectedCash) }}</strong>
            <p>Efectivo esperado</p>
            <small
              >Abierta
              {{
                new Date(summary.currentCash.openedAtUtc).toLocaleTimeString(
                  "es-AR",
                  { hour: "2-digit", minute: "2-digit" },
                )
              }}</small
            ><RouterLink class="primary full" to="/caja"
              >Gestionar caja</RouterLink
            ></template
          ><template v-else
            ><div class="cash-empty">
              <Box :size="32" />
              <p>No hay una caja abierta para este negocio.</p>
            </div>
            <RouterLink class="primary full" to="/caja"
              >Abrir caja</RouterLink
            ></template
          >
        </section>
      </div>
      <div class="dashboard-grid summary-grid">
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>Productos más vendidos</h2>
              <p>Ranking por unidades del último mes.</p>
            </div>
            <Package :size="20" class="muted" />
          </div>
          <div v-if="products.length" class="product-list">
            <article
              v-for="(product, index) in products"
              :key="product.productId"
            >
              <span class="rank">{{ index + 1 }}</span>
              <div>
                <strong>{{ product.name }}</strong
                ><small
                  >{{ product.sku }} ·
                  {{ product.quantitySold }} unidades</small
                >
              </div>
              <strong>{{ money(product.revenue) }}</strong>
            </article>
          </div>
          <div v-else class="empty-small">
            <Package :size="30" />Tus productos destacados aparecerán con las
            primeras ventas.
          </div>
        </section>
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>Últimas transacciones</h2>
              <p>Movimientos recientes de ventas.</p>
            </div>
            <ReceiptText :size="20" class="muted" />
          </div>
          <div v-if="summary.recentSales.length" class="recent-sales">
            <article v-for="sale in summary.recentSales" :key="sale.id">
              <span class="transaction-icon"><ShoppingBag :size="17" /></span>
              <div>
                <strong>{{ sale.customerName }}</strong
                ><small
                  >{{
                    new Date(sale.occurredAtUtc).toLocaleString("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  }}
                  · {{ paymentName(sale.paymentMethod) }}</small
                >
              </div>
              <div>
                <strong>{{ money(sale.totalAmount) }}</strong
                ><span
                  :class="
                    sale.status === 'Cancelled'
                      ? 'status danger'
                      : 'status success-status'
                  "
                  >{{
                    sale.status === "Cancelled" ? "Anulada" : "Cobrada"
                  }}</span
                >
              </div>
            </article>
          </div>
          <div v-else class="empty-small">
            <ReceiptText :size="30" />No hay transacciones recientes.
          </div>
        </section>
      </div>
    </template>
  </template>
  <section
    v-if="!['Owner', 'Admin'].includes(auth.user?.role || '')"
    class="panel"
  >
    <h1>Bienvenido a tu espacio de trabajo</h1>
    <p>Elegí un módulo para comenzar a operar en la sucursal seleccionada.</p>
    <RouterLink
      class="primary"
      :to="auth.user?.role === 'Seller' ? '/ventas' : '/productos'"
      >Comenzar a trabajar</RouterLink
    >
  </section>
</template>
<style scoped>
.dashboard-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.6rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: linear-gradient(120deg, #fff1f2, #fdf2f8 55%, #fff);
  border: 1px solid #fbcfe8;
}
.dashboard-hero h2 {
  margin: 0.35rem 0;
  color: #0f172a;
  font-size: 1.55rem;
}
.dashboard-hero p {
  margin: 0;
  color: #64748b;
}
.dashboard-hero a {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #be185d;
  font-weight: 700;
  white-space: nowrap;
}
.neon-kpis .kpi-card {
  border-top: 3px solid #ec4899;
}
.neon-kpis .kpi-card.violet {
  border-top-color: #c026d3;
}
.neon-kpis .kpi-card.orange {
  border-top-color: #f97316;
}
.neon-kpis .kpi-card.rose {
  border-top-color: #f43f5e;
}
.summary-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.85fr);
  margin-top: 1rem;
}
.chart-panel {
  min-height: 300px;
}
.sales-chart {
  height: 215px;
  margin-top: 1rem;
}
.sales-chart svg {
  display: block;
  width: 100%;
  height: 190px;
  overflow: visible;
}
.chart-grid {
  stroke: #e2e8f0;
  stroke-width: 0.5;
  vector-effect: non-scaling-stroke;
}
.chart-labels {
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 0.76rem;
}
.cash-widget {
  display: flex;
  flex-direction: column;
}
.cash-widget > strong {
  margin-top: 0.6rem;
  color: #0f172a;
  font-size: 2rem;
}
.cash-widget > p {
  margin: 0.25rem 0;
  color: #64748b;
}
.cash-widget small {
  color: #94a3b8;
}
.cash-widget .primary {
  margin-top: auto;
  justify-content: center;
}
.cash-empty {
  display: grid;
  gap: 0.7rem;
  place-items: center;
  text-align: center;
  color: #64748b;
  flex: 1;
  padding: 1rem;
}
.product-list article,
.recent-sales article {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid #f1f5f9;
}
.product-list article:last-child,
.recent-sales article:last-child {
  border-bottom: 0;
}
.rank {
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 0.55rem;
  color: #be185d;
  background: #fce7f3;
  font-weight: 800;
}
.product-list small,
.recent-sales small {
  display: block;
  margin-top: 0.18rem;
  color: #64748b;
}
.transaction-icon {
  display: grid;
  place-items: center;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.65rem;
  color: #db2777;
  background: #fdf2f8;
}
.recent-sales article > div:last-child {
  display: grid;
  justify-items: end;
  gap: 0.25rem;
  text-align: right;
}
@media (max-width: 800px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .dashboard-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .product-list article,
  .recent-sales article {
    grid-template-columns: auto 1fr;
  }
  .product-list article > strong,
  .recent-sales article > div:last-child {
    grid-column: 2;
    justify-self: start;
    justify-items: start;
    text-align: left;
  }
}
</style>
