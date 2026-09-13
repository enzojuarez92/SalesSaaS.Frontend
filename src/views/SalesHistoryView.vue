<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, Eye, LoaderCircle, Printer, X } from "lucide-vue-next";
import { api, apiError, notify } from "../services/api";
import { money } from "../services/format";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { SaleDetail, SalesHistoryRow } from "../types/api";

const auth = useAuthStore(), tenant = useTenantStore();
const rows = ref<SalesHistoryRow[]>([]), selected = ref<SaleDetail | null>(null);
const loading = ref(false), detailLoading = ref(false), paymentMethod = ref<number | "">(""), sellerId = ref(""), from = ref(""), to = ref("");
const sellers = ref<Array<{ id: string; name: string }>>([]);
const paymentOptions = [
  { value: 1, label: "Efectivo" }, { value: 2, label: "Tarjeta de crédito" },
  { value: 3, label: "Tarjeta de débito" }, { value: 4, label: "Transferencia" },
  { value: 5, label: "Mercado Pago" }, { value: 6, label: "Cuenta corriente" },
];
const paymentLabel = (value: number) => paymentOptions.find(option => option.value === value)?.label || "Sin especificar";
const totals = computed(() => paymentOptions.map(option => ({ ...option, total: rows.value.filter(row => row.paymentMethod === option.value && row.status !== "Cancelled").reduce((sum, row) => sum + row.total, 0) })).filter(option => option.total > 0));
const params = () => ({
  tenantId: auth.tenantId,
  warehouseId: tenant.activeWarehouseId || undefined,
  paymentMethod: paymentMethod.value || undefined,
  sellerId: sellerId.value || undefined,
  fromUtc: from.value ? `${from.value}T00:00:00` : undefined,
  toUtc: to.value ? `${to.value}T23:59:59.999` : undefined,
});

async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  try { rows.value = (await api.get<SalesHistoryRow[]>("/sales/history", { params: params() })).data; }
  catch (cause) { notify(apiError(cause), true); }
  finally { loading.value = false; }
}
async function loadSellers() {
  if (!auth.tenantId) return;
  try { sellers.value = (await api.get<Array<{ id: string; name: string }>>("/sales/history/sellers", { params: { tenantId: auth.tenantId } })).data; }
  catch (cause) { notify(apiError(cause), true); }
}
async function openDetail(id: string) {
  detailLoading.value = true;
  try { selected.value = (await api.get<SaleDetail>(`/sales/history/${id}`, { params: { tenantId: auth.tenantId } })).data; }
  catch (cause) { notify(apiError(cause), true); }
  finally { detailLoading.value = false; }
}
function printTicket(sale: SaleDetail) {
  const ticket = window.open("", "_blank", "noopener,noreferrer");
  if (!ticket) { notify("El navegador bloqueó la ventana de impresión.", true); return; }
  const lines = sale.items.map(item => `<tr><td>${item.product}</td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.subtotal)}</td></tr>`).join("");
  ticket.document.write(`<!doctype html><html lang="es"><head><title>${sale.receiptNumber}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}.total{font-size:18px;font-weight:700;text-align:right;margin-top:18px}</style></head><body><h1>Comprobante de venta</h1><p><b>${sale.receiptNumber}</b><br>${new Date(sale.date).toLocaleString("es-AR")}<br>Cliente: ${sale.customer} · ${sale.customerDocument}<br>Vendedor: ${sale.seller}<br>Pago: ${paymentLabel(sale.paymentMethod)}</p><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${lines}</tbody></table><p class="total">Total: ${money(sale.total)}</p><script>window.onload=()=>window.print()<\/script></body></html>`);
  ticket.document.close();
}
watch(() => auth.tenantId, () => { void load(); void loadSellers(); }, { immediate: true });
watch(() => tenant.activeWarehouseId, load);
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Ventas</div><h1>Historial de ventas</h1><p>Consultá comprobantes, medios de pago y el detalle de cada operación.</p></div></div>
  <section class="panel">
    <div class="history-toolbar">
      <label>Desde<input v-model="from" type="date" @change="load" /></label>
      <label>Hasta<input v-model="to" type="date" :min="from || undefined" @change="load" /></label>
      <label>Vendedor<select v-model="sellerId" @change="load"><option value="">Todos los vendedores</option><option v-for="seller in sellers" :key="seller.id" :value="seller.id">{{ seller.name }}</option></select></label>
      <label>Medio de pago<select v-model.number="paymentMethod" @change="load"><option value="">Todos</option><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    </div>
    <div v-if="totals.length" class="payment-summary"><article v-for="item in totals" :key="item.value"><small>{{ item.label }}</small><strong>{{ money(item.total) }}</strong></article></div>
    <div class="responsive-table"><table><thead><tr><th>Fecha y hora</th><th>Comprobante</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      <tr v-if="loading"><td colspan="8" class="empty-small"><LoaderCircle class="spin" /> Cargando ventas…</td></tr>
      <tr v-for="sale in rows" :key="sale.id"><td>{{ new Date(sale.date).toLocaleString("es-AR") }}</td><td><strong>{{ sale.receiptNumber }}</strong></td><td>{{ sale.customer }}</td><td>{{ sale.seller }}</td><td>{{ paymentLabel(sale.paymentMethod) }}</td><td>{{ money(sale.total) }}</td><td><span class="status" :class="sale.status === 'Completed' ? 'success-status' : 'danger'">{{ sale.status === "Completed" ? "Completada" : sale.status }}</span></td><td><div class="history-actions"><button class="icon-button" title="Ver detalle" aria-label="Ver detalle" :disabled="detailLoading" @click="openDetail(sale.id)"><Eye :size="17" /></button><button class="icon-button" title="Imprimir o descargar ticket" aria-label="Imprimir o descargar ticket" :disabled="detailLoading" @click="openDetail(sale.id).then(() => selected && printTicket(selected))"><Download :size="17" /></button></div></td></tr>
      <tr v-if="!loading && !rows.length"><td colspan="8">No hay ventas para la sucursal y filtro seleccionados.</td></tr>
    </tbody></table></div>
  </section>
  <div v-if="selected" class="modal-backdrop"><section class="modal sale-detail"><button class="icon-button modal-close" aria-label="Cerrar" @click="selected = null"><X /></button><h2>Detalle de venta</h2><p><strong>{{ selected.receiptNumber }}</strong> · {{ new Date(selected.date).toLocaleString("es-AR") }}</p><dl class="sale-meta"><div><dt>Cliente</dt><dd>{{ selected.customer }} · {{ selected.customerDocument }}</dd></div><div><dt>Vendedor</dt><dd>{{ selected.seller }}</dd></div><div><dt>Medio de pago</dt><dd>{{ paymentLabel(selected.paymentMethod) }}</dd></div></dl><table class="detail-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Unitario</th><th>Subtotal</th></tr></thead><tbody><tr v-for="item in selected.items" :key="`${item.sku}-${item.product}`"><td>{{ item.product }}<small>{{ item.sku }}</small></td><td>{{ item.quantity }}</td><td>{{ money(item.unitPrice) }}</td><td>{{ money(item.subtotal) }}</td></tr></tbody></table><div class="detail-total"><span>Total</span><strong>{{ money(selected.total) }}</strong></div><div class="modal-actions"><button class="secondary" @click="selected = null">Cerrar</button><button class="primary" @click="printTicket(selected)"><Printer :size="16" />Imprimir / descargar</button></div></section></div>
</template>

<style scoped>
.history-toolbar{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem}.history-toolbar label{display:grid;gap:.35rem}.payment-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem;margin:0 0 1rem}.payment-summary article{display:grid;gap:.2rem;padding:.75rem;border:1px solid #e2e8f0;border-radius:.7rem;background:#f8fafc}.payment-summary small{color:#64748b}.history-actions{display:flex;gap:.4rem}.sale-detail{width:min(100%,720px)}.sale-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin:1rem 0}.sale-meta div{padding:.65rem;border-radius:.6rem;background:#f8fafc}.sale-meta dt,.detail-table small{display:block;color:#64748b;font-size:.75rem}.sale-meta dd{margin:.2rem 0 0;font-weight:600}.detail-table{width:100%;border-collapse:collapse}.detail-table th,.detail-table td{padding:.6rem;border-bottom:1px solid #e2e8f0;text-align:left}.detail-table th:last-child,.detail-table td:last-child{text-align:right}.detail-total{display:flex;justify-content:space-between;margin:1rem 0;font-size:1.1rem}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem}@media(max-width:900px){.history-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.history-toolbar,.sale-meta{grid-template-columns:1fr}.detail-table{font-size:.8rem}}
</style>
