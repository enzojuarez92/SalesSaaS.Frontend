<script setup lang="ts">
import { money } from "../services/format";
import { computed, ref, watch } from "vue";
import { Download, FileText, Package, Printer, RefreshCw } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
type ReportSale = { id?: string; date: string; customer: string; total: number; paymentMethod: number; status: string };
type AuditRow = { id?: string; userName?: string | null; entityName: string; action: string | number; changesJson: string; timestampUtc: string };
type InventoryValuation = { cost?: number; retail?: number };
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
  error = ref(""),
  from = ref(dateInputValue(firstDayOfMonth)),
  to = ref(dateInputValue(today)),
  exporting = ref(false),
  paymentMethod = ref<number | "">("");
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
const entityLabels: Record<string, string> = { Customer: "Clientes", Product: "Productos", Category: "Categorías", Supplier: "Proveedores", Order: "Ventas", OrderItem: "Detalle de venta", StockMovement: "Movimientos de stock", CashRegisterSession: "Sesiones de caja", CashMovement: "Movimientos de caja", PurchaseOrder: "Órdenes de compra", PurchaseOrderItem: "Detalle de compra", PurchaseInvoice: "Facturas de compra", Invoice: "Comprobantes", Warehouse: "Depósitos", Tenant: "Empresa", TenantFiscalProfile: "Configuración fiscal", User: "Usuarios" };
const fieldLabels: Record<string, string> = { Name: "nombre", LegalName: "razón social", Description: "descripción", Price: "precio", Cost: "costo", Stock: "stock", MinimumStockAlert: "alerta mínima", Quantity: "cantidad", Status: "estado", PaymentMethod: "medio de pago", TotalAmount: "importe", IsActive: "activo", Email: "correo", Phone: "teléfono", Address: "dirección", TaxId: "CUIT", Code: "código", Reason: "motivo", Reference: "referencia" };
const ignoredAuditFields = new Set(["Id", "TenantId", "UserId", "WarehouseId", "PasswordHash", "TokenVersion", "CreatedAt", "UpdatedAt"]);
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
    if (!entries.length) return row.action === 1 || row.action === "Create" ? "Registro creado." : row.action === 3 || row.action === "Delete" ? "Registro eliminado." : "Registro actualizado.";
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
async function load(selectedTab = tab.value) {
  error.value = "";
  try {
    if (selectedTab === "sales") rows.value = (await api.get("/reports/sales-summary", { params: salesParams() })).data;
    if (selectedTab === "audit") audit.value = (await api.get("/reports/audit-logs", { params: auditParams() })).data;
    if (selectedTab === "inventory") inventory.value = (await api.get("/reports/inventory-valuation", { params: scopeParams() })).data;
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
function printReport() {
  window.print();
}
watch(() => auth.tenantId, () => void load(), { immediate: true });
watch(() => tenant.activeWarehouseId, () => void load());
watch(tab, (selectedTab) => void load(selectedTab));
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
      ><label v-if="tab === 'sales'">Medio de pago<select v-model.number="paymentMethod"><option value="">Todos</option><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label
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
    <div v-else class="inventory-actions"><div><h2>Valoración actual de stock</h2><p>La valoración refleja el stock disponible en la sucursal seleccionada.</p></div><button type="button" class="secondary" @click="load('inventory')"><RefreshCw :size="16" />Actualizar valoración</button></div>
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
    <div v-if="tab === 'audit'" class="responsive-table audit-table">
      <table>
        <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción / módulo</th><th>Detalle del cambio</th></tr></thead>
        <tbody>
          <tr v-for="a in audit" :key="a.id || `${a.timestampUtc}-${a.entityName}-${a.action}`"><td>{{ new Date(a.timestampUtc).toLocaleString("es-AR") }}</td><td>{{ a.userName || "Sistema" }}</td><td>{{ auditModule(a) }}</td><td>{{ auditDetail(a) }}</td></tr>
          <tr v-if="!audit.length"><td colspan="4">No hay cambios registrados para el período y la sucursal seleccionados.</td></tr>
        </tbody>
      </table>
    </div>
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
.report-toolbar label:has(select) { flex-basis:13rem; }
.report-toolbar input, .report-toolbar select, .report-toolbar button { height:2.75rem; }
.report-toolbar button { display:inline-flex; align-items:center; justify-content:center; gap:.45rem; align-self:flex-end; white-space:nowrap; }
:global(.dark) .report-tabs button { background:#172033; border-color:#40516d; color:#c8d4e6; }
:global(.dark) .report-tabs button:hover { background:#243047; border-color:#f472b6; color:#fbcfe8; }
:global(.dark) .report-tabs button.active { background:#be185d; border-color:#ec4899; color:#fff; }
:global(.dark) .payment-summary article { background:#1b2940; border-color:#35445d; }
:global(.dark) .payment-summary strong { color:#f8fafc; }
.inventory-actions { display:flex; justify-content:space-between; align-items:flex-end; gap:1rem; margin-bottom:1.75rem; padding-bottom:.25rem; }
.inventory-actions h2 { margin:0; font-size:1.05rem; }.inventory-actions p { margin:.3rem 0 0; color:#64748b; }
.inventory-actions button { display:inline-flex; align-items:center; gap:.45rem; height:2.75rem; white-space:nowrap; }
.audit-table td:last-child { min-width:18rem; }
:global(.dark) .inventory-actions p { color:#b8c7dc; }
@media (max-width:760px) { .report-toolbar > * { flex:1 1 100%; } .report-toolbar button, .inventory-actions button { width:100%; } .inventory-actions { align-items:stretch; flex-direction:column; } }
@media print { :global(.sidebar), :global(.topbar), :global(.app-footer), .page-heading, .report-tabs, .report-toolbar { display:none !important; } :global(.page-content) { padding:0 !important; background:#fff !important; } .report-panel { padding:0; border:0; box-shadow:none; background:#fff !important; color:#0f172a !important; } .report-panel :deep(*) { color:#0f172a !important; } .payment-summary article { background:#fff !important; } }
</style>
