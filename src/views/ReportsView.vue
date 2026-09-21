<script setup lang="ts">
import { money } from "../services/format";
import { computed, ref, watch } from "vue";
import { Download, FileText, Package, Printer, RefreshCw, Search, TrendingUp, Wallet } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import TablePaginator from "../components/TablePaginator.vue";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { PagedResult } from "../types/api";
type ReportSale = { id?: string; date: string; customer: string; total: number; paymentMethod: number; status: string };
type AuditRow = { id?: string; userName?: string | null; entityName: string; action: string | number; changesJson: string; timestampUtc: string };
type InventoryValuation = { cost?: number; retail?: number };
type InventoryValuationRow = { sku: string; product: string; category: string; stock: number; unitCost: number; salePrice: number; totalCost: number; totalSale: number };
const dateInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const auth = useAuthStore(),
  tenant = useTenantStore(),
  tab = ref("sales"),
  rows = ref<ReportSale[]>([]),
  audit = ref<AuditRow[]>([]),
  inventory = ref<InventoryValuation | null>(null),
  inventoryRows = ref<InventoryValuationRow[]>([]),
  inventoryResult = ref<PagedResult<InventoryValuationRow> | null>(null),
  error = ref(""),
  from = ref(dateInputValue(firstDayOfMonth)),
  to = ref(dateInputValue(today)),
  exporting = ref(false),
  exportingInventory = ref(false),
  inventorySearch = ref(""),
  auditSearch = ref(""),
  inventoryPage = ref(1),
  auditPage = ref(1),
  paymentMethod = ref<number | "">("");
const tablePageSize = 15;
const paymentOptions = [{ value: 1, label: "Efectivo" }, { value: 5, label: "Mercado Pago" }, { value: 4, label: "Transferencia" }, { value: 2, label: "Tarjeta de crédito" }, { value: 3, label: "Tarjeta de débito" }, { value: 6, label: "Cuenta corriente" }];
const paymentLabel = (method: number) => paymentOptions.find((item) => item.value === method)?.label || "Sin especificar";
const totalsByPayment = computed(() => paymentOptions.map((option) => ({ ...option, total: rows.value.filter((row) => row.paymentMethod === option.value && row.status !== "Cancelled").reduce((sum, row) => sum + row.total, 0) })).filter((item) => item.total > 0));
const scopeParams = () => ({
  tenantId: auth.tenantId,
  warehouseId: tenant.activeWarehouseId || undefined,
});
const salesParams = () => ({
  ...scopeParams(),
  fromUtc: from.value || undefined,
  toUtc: to.value ? `${to.value}T23:59:59.999` : undefined,
  paymentMethod: paymentMethod.value || undefined,
});
const auditParams = () => ({
  ...scopeParams(),
  fromUtc: from.value || undefined,
  toUtc: to.value ? `${to.value}T23:59:59.999` : undefined,
});
const inventoryParams = () => ({ ...scopeParams(), search: inventorySearch.value.trim() || undefined, pageNumber: inventoryPage.value, pageSize: tablePageSize });
const entityLabels: Record<string, string> = { Customer: "Clientes", Product: "Productos", Category: "Categorías", Supplier: "Proveedores", Order: "Ventas", OrderItem: "Detalle de venta", StockMovement: "Movimientos de stock", CashRegisterSession: "Sesiones de caja", CashMovement: "Movimientos de caja", PurchaseOrder: "Órdenes de compra", PurchaseOrderItem: "Detalle de compra", PurchaseInvoice: "Facturas de compra", Invoice: "Comprobantes", Warehouse: "Depósitos", Tenant: "Empresa", TenantFiscalProfile: "Configuración fiscal", User: "Usuarios" };
const fieldLabels: Record<string, string> = { Name: "nombre", LegalName: "razón social", Description: "descripción", Price: "precio", Cost: "costo", Stock: "stock", MinimumStockAlert: "alerta mínima", Quantity: "cantidad", Status: "estado", PaymentMethod: "medio de pago", TotalAmount: "importe", IsActive: "activo", Email: "correo", Phone: "teléfono", Address: "dirección", TaxId: "CUIT", Code: "código", Reason: "motivo", Reference: "referencia" };
const ignoredAuditFields = new Set(["Id", "TenantId", "UserId", "WarehouseId", "CustomerId", "CashRegisterSessionId", "OrderId", "PaymentId", "PlanId", "CheckoutUrl", "PreferenceId", "PasswordHash", "TokenVersion", "CreatedAt", "UpdatedAt", "CreatedAtUtc", "UpdatedAtUtc", "OccurredAtUtc", "Amount", "DiscountAmount"]);
const auditActionLabel = (action: string | number) => ({ "1": "Creación", "2": "Actualización", "3": "Eliminación", Create: "Creación", Update: "Actualización", Delete: "Eliminación" })[String(action)] || "Cambio";
const auditModule = (row: AuditRow) => `${auditActionLabel(row.action)} · ${entityLabels[row.entityName] || row.entityName}`;
function auditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "sin valor";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("es-AR");
  return String(value);
}
function auditDetail(row: AuditRow) {
  try {
    const changes = JSON.parse(row.changesJson) as Record<string, { old?: unknown; new?: unknown; Old?: unknown; New?: unknown }>;
    const entries = Object.entries(changes).filter(([field]) => !ignoredAuditFields.has(field));
    if (!entries.length) return auditFallbackDetail(row);
    const description = entries.slice(0, 2).map(([field, change]) => {
      const label = fieldLabels[field] || field.replace(/([A-Z])/g, " $1").trim().toLowerCase();
      const before = change.old ?? change.Old;
      const after = change.new ?? change.New;
      if (row.action === 1 || row.action === "Create") return `${label}: ${auditValue(after)}`;
      if (row.action === 3 || row.action === "Delete") return `${label}: ${auditValue(before)}`;
      return `${label}: ${auditValue(before)} → ${auditValue(after)}`;
    });
    return description.join(" · ");
  } catch {
    return "Se registró un cambio en este módulo.";
  }
}
function auditFallbackDetail(row: AuditRow) {
  const created = row.action === 1 || row.action === "Create";
  const deleted = row.action === 3 || row.action === "Delete";
  const action = deleted ? "eliminado" : created ? "registrado" : "actualizado";
  const descriptions: Record<string, string> = {
    Order: `Venta ${action}.`,
    StockMovement: `Movimiento de stock ${action}.`,
    CashMovement: `Movimiento de caja ${action}.`,
    SaaSInvoice: created ? "Solicitud de cambio de plan iniciada." : `Suscripción ${action}.`,
    Subscription: `Suscripción ${action}.`,
  };
  return descriptions[row.entityName] || `Registro ${action}.`;
}
const estimatedProfit = computed(() => (inventory.value?.retail || 0) - (inventory.value?.cost || 0));
const estimatedMargin = computed(() => {
  const cost = inventory.value?.cost || 0;
  return cost > 0 ? (estimatedProfit.value / cost) * 100 : 0;
});
const percent = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value) + "%";
const filteredAudit = computed(() => {
  const term = auditSearch.value.trim().toLocaleLowerCase("es-AR");
  if (!term) return audit.value;
  return audit.value.filter((row) => [row.userName, auditModule(row), auditDetail(row), new Date(row.timestampUtc).toLocaleString("es-AR")].some((value) => String(value || "").toLocaleLowerCase("es-AR").includes(term)));
});
const auditTotalPages = computed(() => Math.max(1, Math.ceil(filteredAudit.value.length / tablePageSize)));
const visibleAudit = computed(() => filteredAudit.value.slice((auditPage.value - 1) * tablePageSize, auditPage.value * tablePageSize));
async function load(selectedTab = tab.value) {
  error.value = "";
  try {
    if (selectedTab === "sales") rows.value = (await api.get("/reports/sales-summary", { params: salesParams() })).data;
    if (selectedTab === "audit") {
      audit.value = (await api.get("/reports/audit-logs", { params: auditParams() })).data;
      auditPage.value = 1;
    }
    if (selectedTab === "inventory") {
      const [summary, details] = await Promise.all([
        api.get<InventoryValuation>("/reports/inventory-valuation", { params: scopeParams() }),
        api.get<PagedResult<InventoryValuationRow>>("/reports/inventory-valuation/details", { params: inventoryParams() }),
      ]);
      inventory.value = summary.data;
      inventoryRows.value = details.data.items;
      inventoryResult.value = details.data;
    }
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
      params: salesParams(),
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
async function exportInventory() {
  if (exportingInventory.value) return;
  exportingInventory.value = true;
  error.value = "";
  try {
    const response = await api.get("/reports/inventory-valuation/export-excel", { params: { ...scopeParams(), search: inventorySearch.value.trim() || undefined }, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "valoracion-stock.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    error.value = apiError(e);
  } finally {
    exportingInventory.value = false;
  }
}
function printReport() {
  window.print();
}
watch(() => auth.tenantId, () => void load(), { immediate: true });
watch(() => tenant.activeWarehouseId, () => void load());
watch(tab, (selectedTab) => void load(selectedTab));
watch(inventorySearch, () => { inventoryPage.value = 1; if (tab.value === "inventory") void load("inventory"); });
watch(auditSearch, () => { auditPage.value = 1; });
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Reportes</div>
      <h1>Reportes avanzados</h1>
      <p>Ventas, inventario y trazabilidad.</p>
    </div>
  </div>
  <div class="tabs report-tabs" role="tablist" aria-label="Tipo de reporte">
    <button type="button" role="tab" :aria-selected="tab === 'sales'" :class="{ active: tab === 'sales' }" @click="tab = 'sales'">Ventas e IVA</button
    ><button type="button" role="tab" :aria-selected="tab === 'inventory'" :class="{ active: tab === 'inventory' }" @click="tab = 'inventory'">Inventario</button
    ><button type="button" role="tab" :aria-selected="tab === 'audit'" :class="{ active: tab === 'audit' }" @click="tab = 'audit'">Auditoría</button>
  </div>
  <section class="panel report-panel">
    <div v-if="tab !== 'inventory'" class="report-toolbar">
      <label>Desde<input v-model="from" type="date" /></label
      ><label>Hasta<input v-model="to" type="date" /></label
      ><label v-if="tab === 'sales'" class="payment-filter">Medio de pago<span class="payment-select"><Wallet :size="17" /><select v-model.number="paymentMethod"><option value="">Todos</option><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></span></label
      ><label v-else>Buscar<input v-model.trim="auditSearch" placeholder="Usuario, acción o detalle" /></label
      ><button type="button" class="secondary" @click="load()">Aplicar</button
      ><button
        v-if="tab === 'sales'"
        type="button"
        class="primary"
        :disabled="exporting"
        @click="excel"
      >
        <Download :size="16" />{{
          exporting ? "Generando…" : "Exportar Excel (.xlsx)"
        }}
      </button><button v-if="tab === 'sales'" type="button" class="secondary" @click="printReport"><Printer :size="16" />Imprimir / Exportar PDF</button>
    </div>
    <div v-else class="inventory-actions"><div><h2>Valoración actual de stock</h2><p>La valoración refleja el stock disponible en la sucursal seleccionada.</p></div><div class="inventory-action-buttons"><button type="button" class="secondary" @click="load('inventory')"><RefreshCw :size="16" />Actualizar valoración</button><button type="button" class="primary" :disabled="exportingInventory" @click="exportInventory"><Download :size="16" />{{ exportingInventory ? "Generando…" : "Exportar valoración (Excel)" }}</button><button type="button" class="secondary" @click="printReport"><Printer :size="16" />PDF</button></div></div>
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
    <div v-if="tab === 'inventory'" class="account-summary inventory-summary">
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
      <article>
        <TrendingUp />
        <div>
          <p>Ganancia estimada</p>
          <strong>{{ money(estimatedProfit) }}</strong>
          <small>Margen estimado: {{ percent(estimatedMargin) }}</small>
        </div>
      </article>
    </div>
    <template v-if="tab === 'inventory'"><div class="valuation-table-heading"><div><h2>Detalle de valoración</h2><p>Costos y precios vigentes para el stock de la sucursal activa.</p></div><label class="inventory-search"><Search :size="16" /><input v-model.trim="inventorySearch" placeholder="Buscar por producto o categoría" /></label></div><div class="responsive-table valuation-table"><table><thead><tr><th>Código / SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Costo unitario</th><th>Precio venta</th><th>Total costo</th><th>Total venta</th></tr></thead><tbody><tr v-for="item in inventoryRows" :key="item.sku"><td>{{ item.sku }}</td><td>{{ item.product }}</td><td>{{ item.category }}</td><td>{{ item.stock }}</td><td>{{ money(item.unitCost) }}</td><td>{{ money(item.salePrice) }}</td><td>{{ money(item.totalCost) }}</td><td>{{ money(item.totalSale) }}</td></tr><tr v-if="!inventoryRows.length"><td colspan="8">No hay productos que coincidan con la búsqueda.</td></tr></tbody></table></div><TablePaginator v-if="inventoryResult" :page="inventoryPage" :total-pages="inventoryResult.totalPages" :total-count="inventoryResult.totalCount" :shown-count="inventoryRows.length" :page-size="tablePageSize" @previous="inventoryPage--; load('inventory')" @next="inventoryPage++; load('inventory')" /></template>
    <div v-if="tab === 'audit'" class="responsive-table audit-table">
      <table>
        <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción / módulo</th><th>Detalle del cambio</th></tr></thead>
        <tbody>
          <tr v-for="a in visibleAudit" :key="a.id || `${a.timestampUtc}-${a.entityName}-${a.action}`"><td>{{ new Date(a.timestampUtc).toLocaleString("es-AR") }}</td><td>{{ a.userName || "Sistema" }}</td><td>{{ auditModule(a) }}</td><td>{{ auditDetail(a) }}</td></tr>
          <tr v-if="!filteredAudit.length"><td colspan="4">No hay cambios que coincidan con los filtros aplicados.</td></tr>
        </tbody>
      </table>
    </div>
    <TablePaginator v-if="tab === 'audit'" :page="auditPage" :total-pages="auditTotalPages" :total-count="filteredAudit.length" :shown-count="visibleAudit.length" :page-size="tablePageSize" @previous="auditPage--" @next="auditPage++" />
  </section>
</template>
<style scoped>
.payment-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem;margin:0 0 1rem}.payment-summary article{display:grid;gap:.2rem;padding:.75rem;border:1px solid #e2e8f0;border-radius:.7rem;background:#f8fafc}.payment-summary small{color:#64748b}.payment-summary strong{color:#0f172a}
.report-tabs { display:flex; flex-wrap:wrap; gap:.6rem; margin-bottom:1rem; }
.report-tabs button { padding:.65rem 1rem; border:1px solid #dbe3ef; border-radius:.65rem; background:#fff; color:#475569; font-weight:650; }
.report-tabs button:hover { border-color:#f9a8d4; color:#be185d; background:#fdf2f8; }
.report-tabs button.active { border-color:#ec4899; background:#ec4899; color:#fff; box-shadow:0 6px 14px #ec489933; }
.report-toolbar { display:flex; flex-wrap:wrap; align-items:flex-end; gap:1rem; margin-bottom:1.75rem; padding-bottom:.25rem; }
.report-toolbar label { flex:1 1 10.5rem; min-width:0; }
.report-toolbar input, .report-toolbar select, .report-toolbar button { height:2.75rem; }
.report-toolbar .payment-filter { flex:0 1 16.25rem; }
.payment-select { position:relative; display:flex; align-items:center; }
.payment-select svg { position:absolute; left:.8rem; z-index:1; color:#db2777; pointer-events:none; }
.payment-select select { width:100%; padding-left:2.45rem; }
.report-toolbar button { display:inline-flex; align-items:center; justify-content:center; gap:.45rem; align-self:flex-end; white-space:nowrap; }
:global(.dark) .report-tabs button { background:#172033; border-color:#40516d; color:#c8d4e6; }
:global(.dark) .report-tabs button:hover { background:#243047; border-color:#f472b6; color:#fbcfe8; }
:global(.dark) .report-tabs button.active { background:#be185d; border-color:#ec4899; color:#fff; }
:global(.dark) .payment-summary article { background:#1b2940; border-color:#35445d; }
:global(.dark) .payment-summary strong { color:#f8fafc; }
.inventory-actions { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; margin-bottom:1.75rem; padding-bottom:.25rem; }
.inventory-actions h2 { margin:0; font-size:1.05rem; }.inventory-actions p { margin:.3rem 0 0; color:#64748b; }
.inventory-actions button { display:inline-flex; align-items:center; gap:.45rem; height:2.75rem; white-space:nowrap; }
.inventory-action-buttons { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:.65rem; }
.inventory-summary { margin-bottom:1.6rem; }.inventory-summary article small { display:block; margin-top:.25rem; color:#64748b; }
.valuation-table-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; margin:1.25rem 0 .9rem; }.valuation-table-heading h2 { margin:0; font-size:1.05rem; }.valuation-table-heading p { margin:.3rem 0 0; color:#64748b; }
.inventory-search { display:flex; align-items:center; gap:.45rem; min-width:min(100%,20rem); color:#64748b; }.inventory-search input { width:100%; }.valuation-table td:nth-child(n+4), .valuation-table th:nth-child(n+4) { text-align:right; }
.audit-table td:last-child { min-width:18rem; }
:global(.dark) .inventory-actions p { color:#b8c7dc; }
@media (max-width:760px) { .report-toolbar > * { flex:1 1 100%; } .report-toolbar button, .inventory-actions button { width:100%; } .inventory-actions, .valuation-table-heading { align-items:stretch; flex-direction:column; } .inventory-action-buttons { flex-direction:column; } .inventory-search { min-width:0; } }
@media print { :global(.sidebar), :global(.topbar), :global(.app-footer), .page-heading, .report-tabs, .report-toolbar, .inventory-actions, .valuation-table-heading, :deep(.table-pagination) { display:none !important; } :global(.page-content) { padding:0 !important; background:#fff !important; } .report-panel { padding:0; border:0; box-shadow:none; background:#fff !important; color:#0f172a !important; } .report-panel :deep(*) { color:#0f172a !important; } .payment-summary article { background:#fff !important; } }
</style>
