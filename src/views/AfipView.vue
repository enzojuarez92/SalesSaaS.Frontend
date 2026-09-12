<script setup lang="ts">
import { money } from "../services/format";
import { computed, ref, watch } from "vue";
import { CheckCircle2, Clock3, Download, ExternalLink, FileText, LoaderCircle, QrCode, RefreshCw, RotateCcw, Send, XCircle } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import type { Invoice, PagedResult } from "../types/api";

const auth = useAuthStore();
const invoices = ref<Invoice[]>([]);
const loading = ref(false);
const retryingId = ref("");
const error = ref("");
const success = ref("");
const filter = ref("");
const customerFilter = ref("");
const dateFrom = ref("");
const dateTo = ref("");
const page = ref(1);
const result = ref<PagedResult<Invoice> | null>(null);
const qrInvoice = ref<Invoice | null>(null);

const status = (invoice: Invoice) => invoice.cae ? "approved" : invoice.afipResult === "Internal" ? "internal" : invoice.afipResult === "Rejected" || invoice.afipResult === "Error" ? "rejected" : "pending";
const statusLabel = (invoice: Invoice) => ({ approved: "Aprobado con CAE", rejected: "Rechazado por ARCA", pending: "Pendiente de ARCA", internal: "Ticket interno / no fiscal" })[status(invoice)];
const statusIcon = computed(() => ({ approved: CheckCircle2, rejected: XCircle, pending: Clock3, internal: FileText }));
const canRetry = (invoice: Invoice) => !invoice.cae && Boolean(invoice.afipVoucherType) && invoice.status !== "Cancelled" && invoice.afipResult !== "Internal";

function notifySuccess(message: string) {
  success.value = message;
  window.setTimeout(() => (success.value = ""), 5000);
}
async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<PagedResult<Invoice>>("/sales/invoices", { params: { tenantId: auth.tenantId, status: filter.value || undefined, customer: customerFilter.value || undefined, dateFrom: dateFrom.value || undefined, dateTo: dateTo.value || undefined, pageNumber: page.value, pageSize: 12 } });
    result.value = data;
    invoices.value = data.items;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}
async function retryEmission(invoice: Invoice) {
  if (!canRetry(invoice) || retryingId.value) return;
  retryingId.value = invoice.id;
  error.value = "";
  try {
    const { data } = await api.post<{ cae: string | null; errors: string | null; voucherType: number | null }>("/invoices/issue", { tenantId: auth.tenantId, orderId: invoice.orderId, documentType: 0 });
    await load();
    if (data.cae) notifySuccess(`ARCA autorizó el comprobante ${invoice.number} y asignó su CAE.`);
    else if (data.voucherType === null && !data.errors) notifySuccess(`${invoice.number} quedó como ticket interno / no fiscal porque ARCA no está habilitada en este entorno.`);
    else error.value = `ARCA no pudo autorizar ${invoice.number}. ${data.errors || "Revisá la configuración fiscal y reintentá."}`;
  } catch (cause) {
    error.value = `No se pudo emitir en ARCA. ${apiError(cause)}`;
  } finally {
    retryingId.value = "";
  }
}
function printInvoice(invoice: Invoice) { const fiscalState = invoice.cae ? `CAE: ${invoice.cae}` : invoice.afipResult === "Internal" ? "Ticket interno / no fiscal" : "Pendiente de autorización por ARCA"; const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) return; popup.document.write(`<title>Comprobante ${invoice.number}</title><main style="font-family:system-ui;padding:32px;color:#0f172a"><h1>Comprobante ${invoice.number}</h1><p>Cliente: ${invoice.customerName}</p><p>Emitido: ${new Date(invoice.issuedAtUtc).toLocaleString("es-AR")}</p><h2>Total: ${money(invoice.totalAmount)}</h2><p>${fiscalState}</p></main>`); popup.document.close(); popup.print(); }
function download(invoice: Invoice) { const fiscalState = invoice.cae ? `CAE: ${invoice.cae}` : invoice.afipResult === "Internal" ? "Ticket interno / no fiscal" : "Pendiente de ARCA"; const body = `Comprobante ${invoice.number}\nCliente: ${invoice.customerName}\nFecha: ${new Date(invoice.issuedAtUtc).toLocaleString("es-AR")}\nTotal: ${money(invoice.totalAmount)}\n${fiscalState}`; const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${invoice.number}.txt`; link.click(); URL.revokeObjectURL(url); }
async function creditNote(invoice: Invoice) { if (!window.confirm(`¿Emitir una nota de crédito para ${invoice.number}?`)) return; const type = invoice.afipVoucherType === 1 ? 4 : invoice.afipVoucherType === 11 ? 6 : 5; try { await api.post("/invoices/issue", { tenantId: auth.tenantId, orderId: invoice.orderId, documentType: type, associatedInvoiceId: invoice.id }); await load(); } catch (cause) { error.value = apiError(cause); } }
watch([() => auth.tenantId, filter, customerFilter, dateFrom, dateTo], () => { page.value = 1; void load(); }, { immediate: true });
</script>
<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Facturación</div><h1>Facturación ARCA</h1><p>Consultá el estado fiscal de cada comprobante emitido.</p></div><button class="secondary" :disabled="loading" @click="load"><RefreshCw :size="16" />Actualizar</button></div>
  <section class="panel"><div class="invoice-toolbar"><div class="status-filters"><button :class="{ active: !filter }" @click="filter = ''">Todos</button><button :class="{ active: filter === 'Approved' }" @click="filter = 'Approved'">Aprobados</button><button :class="{ active: filter === 'Rejected' }" @click="filter = 'Rejected'">Rechazados</button><button :class="{ active: filter === 'Pending' }" @click="filter = 'Pending'">Pendientes</button></div><label class="invoice-search">Cliente<input v-model.trim="customerFilter" placeholder="Buscar cliente" /></label><label>Desde<input v-model="dateFrom" type="date" /></label><label>Hasta<input v-model="dateTo" type="date" /></label><span class="muted">{{ result?.totalCount ?? 0 }} comprobantes</span></div><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="success" class="success" role="status">{{ success }}</p><div v-if="loading" class="empty-small"><RefreshCw class="spin" /> Cargando comprobantes…</div><div v-else-if="!invoices.length" class="empty-state compact"><FileText :size="34"/><h2>No hay comprobantes</h2><p>Los comprobantes emitidos desde el POS aparecerán aquí.</p></div><div v-else class="responsive-table"><table><thead><tr><th>Comprobante</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado ARCA</th><th>Acciones</th></tr></thead><tbody><tr v-for="invoice in invoices" :key="invoice.id"><td data-label="Comprobante"><strong>{{ invoice.number }}</strong><small v-if="invoice.cae">CAE {{ invoice.cae }}</small></td><td data-label="Cliente">{{ invoice.customerName }}</td><td data-label="Fecha">{{ new Date(invoice.issuedAtUtc).toLocaleDateString('es-AR') }}</td><td data-label="Total"><strong>{{ money(invoice.totalAmount) }}</strong></td><td data-label="Estado ARCA"><span class="afip-status" :class="status(invoice)"><component :is="statusIcon[status(invoice)]" :size="14" />{{ statusLabel(invoice) }}</span><small v-if="invoice.afipErrors" class="afip-error">{{ invoice.afipErrors }}</small></td><td data-label="Acciones"><div class="invoice-actions"><button v-if="canRetry(invoice)" title="Reintentar emisión en ARCA" :aria-label="`Reintentar emisión en ARCA para ${invoice.number}`" :disabled="retryingId === invoice.id" @click="retryEmission(invoice)"><LoaderCircle v-if="retryingId === invoice.id" class="spin" :size="16"/><Send v-else :size="16"/></button><button title="Reimprimir" @click="printInvoice(invoice)"><FileText :size="16"/></button><button title="Descargar resumen" @click="download(invoice)"><Download :size="16"/></button><button v-if="invoice.status === 'Issued' && invoice.afipVoucherType && ![3,8,13].includes(invoice.afipVoucherType)" title="Emitir nota de crédito" @click="creditNote(invoice)"><RotateCcw :size="16"/></button><button v-if="invoice.barCode" title="Ver QR ARCA" @click="qrInvoice = invoice"><QrCode :size="16"/></button></div></td></tr></tbody></table></div><div v-if="result && result.totalPages > 1" class="pagination"><button class="secondary" :disabled="page === 1" @click="page--; load()">Anterior</button><span>Página {{ page }} de {{ result.totalPages }}</span><button class="secondary" :disabled="page === result.totalPages" @click="page++; load()">Siguiente</button></div></section>
  <div v-if="qrInvoice" class="modal-backdrop" @click.self="qrInvoice = null"><section class="modal"><button class="icon-button modal-close" @click="qrInvoice = null"><XCircle/></button><div class="modal-icon"><QrCode/></div><h2>Código QR ARCA</h2><p>Este comprobante tiene CAE {{ qrInvoice.cae }}. Abrí el enlace para consultar su validación en ARCA.</p><a class="primary full" :href="qrInvoice.barCode!" target="_blank" rel="noopener"><ExternalLink :size="17"/>Abrir QR de ARCA</a></section></div>
</template>
