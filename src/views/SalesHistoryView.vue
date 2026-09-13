<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Banknote, CircleEllipsis, CreditCard, Eye, Landmark, LoaderCircle, Printer, Smartphone, Wallet, X } from "lucide-vue-next";
import { paymentMethodLabel, paymentMethodOptions } from "../constants/paymentMethods";
import { api, apiError, notify } from "../services/api";
import { money } from "../services/format";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import TablePaginator from "../components/TablePaginator.vue";
import type { PagedResult, SaleDetail, SalesHistoryRow } from "../types/api";

const auth = useAuthStore(), tenant = useTenantStore();
const rows = ref<SalesHistoryRow[]>([]), selected = ref<SaleDetail | null>(null), result = ref<PagedResult<SalesHistoryRow> | null>(null);
const loading = ref(false), detailLoading = ref(false), paymentMethod = ref<number | "">(""), sellerId = ref(""), from = ref(""), to = ref("");
const page = ref(1);
const paymentTotals = ref<Array<{ paymentMethod: number; total: number }>>([]);
const sellers = ref<Array<{ id: string; name: string }>>([]);
const paymentIcons = { 1: Banknote, 2: CreditCard, 3: CreditCard, 4: Landmark, 5: Smartphone, 6: Wallet, 7: Smartphone, 8: CircleEllipsis };
const selectedPaymentIcon = computed(() => paymentIcons[paymentMethod.value as keyof typeof paymentIcons] || Wallet);
const totals = computed(() => paymentMethodOptions.map(option => ({ ...option, total: paymentTotals.value.find(total => total.paymentMethod === option.value)?.total ?? 0 })).filter(option => option.total > 0));
const params = () => ({
  tenantId: auth.tenantId,
  warehouseId: tenant.activeWarehouseId || undefined,
  paymentMethod: paymentMethod.value || undefined,
  sellerId: sellerId.value || undefined,
  fromUtc: from.value ? `${from.value}T00:00:00` : undefined,
  toUtc: to.value ? `${to.value}T23:59:59.999` : undefined,
  pageNumber: page.value,
  pageSize: 25,
});

async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  try {
    const { data } = await api.get<PagedResult<SalesHistoryRow>>("/sales/history", { params: params() });
    result.value = data;
    rows.value = data.items;
    try {
      paymentTotals.value = (await api.get<Array<{ paymentMethod: number; total: number }>>("/sales/history/totals", { params: params() })).data;
    } catch (cause) {
      paymentTotals.value = rows.value.filter(row => row.status !== "Cancelled").reduce<Array<{ paymentMethod: number; total: number }>>((totals, row) => {
        const current = totals.find(total => total.paymentMethod === row.paymentMethod);
        if (current) current.total += row.total;
        else totals.push({ paymentMethod: row.paymentMethod, total: row.total });
        return totals;
      }, []);
    }
  }
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
function applyFilters() {
  page.value = 1;
  void load();
}
function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}
function printTicket(sale: SaleDetail) {
  const lines = sale.items.map(item => `<tr><td>${escapeHtml(item.product)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(money(item.unitPrice))}</td><td>${escapeHtml(money(item.subtotal))}</td></tr>`).join("");
  const documentHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(sale.receiptNumber)}</title><style>@page{margin:16mm}body{font-family:Arial,sans-serif;margin:0;color:#172033;font-size:13px}h1{margin:0 0 16px;font-size:22px}p{line-height:1.6}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px 8px;border-bottom:1px solid #dbe2ea;text-align:left}th{color:#475569;font-size:11px;text-transform:uppercase}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.total{font-size:18px;font-weight:700;text-align:right;margin-top:20px}</style></head><body><h1>Comprobante de venta</h1><p><b>${escapeHtml(sale.receiptNumber)}</b><br>${escapeHtml(new Date(sale.date).toLocaleString("es-AR"))}<br>Cliente: ${escapeHtml(sale.customer)} · ${escapeHtml(sale.customerDocument)}<br>Vendedor: ${escapeHtml(sale.seller)}<br>Pago: ${escapeHtml(paymentMethodLabel(sale.paymentMethod))}</p><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${lines}</tbody></table><p class="total">Total: ${escapeHtml(money(sale.total))}</p><script>window.addEventListener("load",()=>{window.focus();window.print();});<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([documentHtml], { type: "text/html;charset=utf-8" }));
  const ticket = window.open(url, "_blank", "noopener,noreferrer");
  if (!ticket) {
    URL.revokeObjectURL(url);
    notify("El navegador bloqueó la ventana de impresión.", true);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
watch(() => auth.tenantId, () => { void load(); void loadSellers(); }, { immediate: true });
watch(() => tenant.activeWarehouseId, load);
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Ventas</div><h1>Historial de ventas</h1><p>Consultá comprobantes, medios de pago y el detalle de cada operación.</p></div></div>
  <section class="panel">
    <div class="history-toolbar">
      <label>Desde<input v-model="from" type="date" @change="applyFilters" /></label>
      <label>Hasta<input v-model="to" type="date" :min="from || undefined" @change="applyFilters" /></label>
      <label>Vendedor<select v-model="sellerId" @change="applyFilters"><option value="">Todos los vendedores</option><option v-for="seller in sellers" :key="seller.id" :value="seller.id">{{ seller.name }}</option></select></label>
      <label>Medio de pago<span class="select-with-icon"><component :is="selectedPaymentIcon" :size="17" /><select v-model.number="paymentMethod" @change="applyFilters"><option value="">Todos</option><option v-for="option in paymentMethodOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></span></label>
    </div>
    <div v-if="totals.length" class="payment-summary"><article v-for="item in totals" :key="item.value"><small>{{ item.label }}</small><strong>{{ money(item.total) }}</strong></article></div>
    <div class="responsive-table"><table><thead><tr><th>Fecha y hora</th><th>Comprobante</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      <tr v-if="loading"><td colspan="8" class="empty-small"><LoaderCircle class="spin" /> Cargando ventas…</td></tr>
      <tr v-for="sale in rows" :key="sale.id"><td>{{ new Date(sale.date).toLocaleString("es-AR") }}</td><td><strong>{{ sale.receiptNumber }}</strong></td><td>{{ sale.customer }}</td><td>{{ sale.seller }}</td><td>{{ paymentMethodLabel(sale.paymentMethod) }}</td><td>{{ money(sale.total) }}</td><td><span class="status" :class="sale.status === 'Completed' ? 'success-status' : 'danger'">{{ sale.status === "Completed" ? "Completada" : sale.status }}</span></td><td><div class="invoice-actions"><button title="Ver detalle" aria-label="Ver detalle" :disabled="detailLoading" @click="openDetail(sale.id)"><Eye :size="17" /></button></div></td></tr>
      <tr v-if="!loading && !rows.length"><td colspan="8">No hay ventas para la sucursal y filtro seleccionados.</td></tr>
    </tbody></table></div>
    <TablePaginator
      v-if="result"
      :page="page"
      :total-pages="result.totalPages"
      :total-count="result.totalCount"
      :shown-count="rows.length"
      :page-size="result.pageSize"
      @previous="page--; load()"
      @next="page++; load()"
    />
  </section>
  <div v-if="selected" class="modal-backdrop"><section class="modal sale-detail"><button class="icon-button modal-close" aria-label="Cerrar" @click="selected = null"><X /></button><h2>Detalle de venta</h2><p><strong>{{ selected.receiptNumber }}</strong> · {{ new Date(selected.date).toLocaleString("es-AR") }}</p><dl class="sale-meta"><div><dt>Cliente</dt><dd>{{ selected.customer }} · {{ selected.customerDocument }}</dd></div><div><dt>Vendedor</dt><dd>{{ selected.seller }}</dd></div><div><dt>Medio de pago</dt><dd>{{ paymentMethodLabel(selected.paymentMethod) }}</dd></div></dl><table class="detail-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Unitario</th><th>Subtotal</th></tr></thead><tbody><tr v-for="item in selected.items" :key="`${item.sku}-${item.product}`"><td>{{ item.product }}<small>{{ item.sku }}</small></td><td>{{ item.quantity }}</td><td>{{ money(item.unitPrice) }}</td><td>{{ money(item.subtotal) }}</td></tr></tbody></table><div class="detail-total"><span>Total</span><strong>{{ money(selected.total) }}</strong></div><div class="modal-actions"><button class="secondary" @click="selected = null">Cerrar</button><button class="primary" @click="printTicket(selected)"><Printer :size="16" />Imprimir / descargar</button></div></section></div>
</template>

<style scoped>
.history-toolbar{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem}.history-toolbar label{display:grid;gap:.35rem}.select-with-icon{position:relative;display:block}.select-with-icon svg{position:absolute;z-index:1;top:50%;left:.75rem;transform:translateY(-50%);color:#64748b;pointer-events:none}.select-with-icon select{padding-left:2.5rem}.payment-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem;margin:0 0 1rem}.payment-summary article{display:grid;gap:.2rem;padding:.75rem;border:1px solid #e2e8f0;border-radius:.7rem;background:#f8fafc}.payment-summary small{color:#64748b}.sale-detail{width:min(100%,720px)}.sale-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin:1rem 0}.sale-meta div{padding:.65rem;border-radius:.6rem;background:#f8fafc}.sale-meta dt,.detail-table small{display:block;color:#64748b;font-size:.75rem}.sale-meta dd{margin:.2rem 0 0;font-weight:600}.detail-table{width:100%;border-collapse:collapse}.detail-table th,.detail-table td{padding:.6rem;border-bottom:1px solid #e2e8f0;text-align:left}.detail-table th:last-child,.detail-table td:last-child{text-align:right}.detail-total{display:flex;justify-content:space-between;margin:1rem 0;font-size:1.1rem}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem}@media(max-width:900px){.history-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.history-toolbar,.sale-meta{grid-template-columns:1fr}}
</style>
