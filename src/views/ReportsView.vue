<script setup lang="ts">
import { money } from "../services/format";
import { computed, ref, watch } from "vue";
import { Download, FileText, Package, ShieldCheck } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
type ReportSale = { id?: string; date: string; customer: string; total: number; paymentMethod: number; status: string };
type AuditRow = { id?: string; entityName: string; action: string; timestampUtc: string };
type InventoryValuation = { cost?: number; retail?: number };
const auth = useAuthStore(),
  tenant = useTenantStore(),
  tab = ref("sales"),
  rows = ref<ReportSale[]>([]),
  audit = ref<AuditRow[]>([]),
  inventory = ref<InventoryValuation | null>(null),
  error = ref(""),
  from = ref(""),
  to = ref(""),
  exporting = ref(false),
  paymentMethod = ref<number | "">("");
const paymentOptions = [{ value: 1, label: "Efectivo" }, { value: 5, label: "Mercado Pago" }, { value: 4, label: "Transferencia" }, { value: 2, label: "Tarjeta de crédito" }, { value: 3, label: "Tarjeta de débito" }, { value: 6, label: "Cuenta corriente" }];
const paymentLabel = (method: number) => paymentOptions.find((item) => item.value === method)?.label || "Sin especificar";
const totalsByPayment = computed(() => paymentOptions.map((option) => ({ ...option, total: rows.value.filter((row) => row.paymentMethod === option.value && row.status !== "Cancelled").reduce((sum, row) => sum + row.total, 0) })).filter((item) => item.total > 0));
const p = () => ({
  tenantId: auth.tenantId,
  warehouseId: tenant.activeWarehouseId || undefined,
  fromUtc: from.value || undefined,
  toUtc: to.value || undefined,
  paymentMethod: paymentMethod.value || undefined,
});
async function load() {
  try {
    rows.value = (
      await api.get("/reports/sales-summary", { params: p() })
    ).data;
    audit.value = (await api.get("/reports/audit-logs", { params: p() })).data;
    inventory.value = (
      await api.get("/reports/inventory-valuation", { params: p() })
    ).data;
  } catch (e) {
    error.value = apiError(e);
  }
}
async function excel() {
  if (exporting.value) return;
  exporting.value = true;
  error.value = "";
  try {
    const response = await api.get("/reports/sales/export-excel", {
      params: p(),
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data),
      link = document.createElement("a");
    link.href = url;
    link.download = "ventas.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    error.value = apiError(e);
  } finally {
    exporting.value = false;
  }
}
watch(() => auth.tenantId, load, { immediate: true });
watch(() => tenant.activeWarehouseId, load);
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Reportes</div>
      <h1>Reportes avanzados</h1>
      <p>Ventas, inventario y trazabilidad.</p>
    </div>
  </div>
  <div class="tabs">
    <button @click="tab = 'sales'">Ventas e IVA</button
    ><button @click="tab = 'inventory'">Inventario</button
    ><button @click="tab = 'audit'">Auditoría</button>
  </div>
  <section class="panel">
    <div class="inventory-toolbar">
      <label>Desde<input v-model="from" type="date" /></label
      ><label>Hasta<input v-model="to" type="date" /></label
      ><label v-if="tab === 'sales'">Medio de pago<select v-model.number="paymentMethod"><option value="">Todos</option><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label
      ><button class="secondary" @click="load">Aplicar</button
      ><button
        v-if="tab === 'sales'"
        class="primary"
        :disabled="exporting"
        @click="excel"
      >
        <Download :size="16" />{{
          exporting ? "Generando…" : "Exportar Excel (.xlsx)"
        }}
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="tab === 'sales'" class="responsive-table">
      <div v-if="totalsByPayment.length" class="payment-summary"><article v-for="item in totalsByPayment" :key="item.value"><small>{{ item.label }}</small><strong>{{ money(item.total) }}</strong></article></div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Pago</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id || `${r.date}-${r.customer}`">
            <td>{{ new Date(r.date).toLocaleDateString("es-AR") }}</td>
            <td>{{ r.customer }}</td>
            <td>{{ money(r.total) }}</td>
            <td>{{ paymentLabel(r.paymentMethod) }}</td>
            <td>{{ r.status }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5">
              No hay ventas para el período y la sucursal seleccionados.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="tab === 'inventory'" class="account-summary">
      <article>
        <Package />
        <div>
          <p>Capital invertido</p>
          <strong>{{ money(inventory?.cost) }}</strong>
        </div>
      </article>
      <article>
        <FileText />
        <div>
          <p>Valor de venta</p>
          <strong>{{ money(inventory?.retail) }}</strong>
        </div>
      </article>
    </div>
    <div v-if="tab === 'audit'" class="statement-list">
      <article v-for="a in audit" :key="a.id || `${a.timestampUtc}-${a.entityName}-${a.action}`">
        <ShieldCheck />
        <div>
          <strong>{{ a.entityName }} · {{ a.action }}</strong
          ><small>{{ new Date(a.timestampUtc).toLocaleString("es-AR") }}</small>
        </div>
      </article>
    </div>
  </section>
</template>
<style scoped>
.payment-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem;margin:0 0 1rem}.payment-summary article{display:grid;gap:.2rem;padding:.75rem;border:1px solid #e2e8f0;border-radius:.7rem;background:#f8fafc}.payment-summary small{color:#64748b}.payment-summary strong{color:#0f172a}
</style>
