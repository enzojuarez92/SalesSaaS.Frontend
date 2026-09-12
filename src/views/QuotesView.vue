<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Ban, FilePenLine, LoaderCircle } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { money, dateTime } from "../services/format";

type Quote = {
  id: string;
  customerId: string;
  customer: string;
  totalAmount: number;
  expiresAtUtc: string;
  status: string;
  items: Array<{ productId: string; quantity: number }>;
};

const router = useRouter();
const rows = ref<Quote[]>([]);
const loading = ref(false);
const cancelingId = ref("");
const error = ref("");
const success = ref("");

const isCurrent = (quote: Quote) =>
  quote.status === "Draft" && new Date(quote.expiresAtUtc).getTime() >= Date.now();
const statusLabel = (quote: Quote) => {
  if (quote.status === "Cancelled") return "Anulado";
  return isCurrent(quote) ? "Vigente" : "Vencido";
};

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = (await api.get<Quote[]>("/sales/quotes")).data;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}
function loadInPos(quote: Quote) {
  sessionStorage.setItem(
    "salessaas.quote-to-load",
    JSON.stringify({ id: quote.id, customerId: quote.customerId, items: quote.items }),
  );
  void router.push("/ventas");
}
async function cancel(quote: Quote) {
  if (!isCurrent(quote) || cancelingId.value) return;
  if (!window.confirm(`¿Anular el presupuesto de ${quote.customer}? Esta acción no se puede deshacer.`)) return;
  cancelingId.value = quote.id;
  error.value = "";
  try {
    await api.post(`/sales/quotes/${quote.id}/cancel`);
    success.value = "Presupuesto anulado.";
    window.setTimeout(() => (success.value = ""), 5000);
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    cancelingId.value = "";
  }
}
onMounted(load);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>Presupuestos</h1>
      <p>Propuestas comerciales del negocio. No reservan stock ni representan una venta.</p>
    </div>
    <RouterLink class="primary" to="/ventas">Preparar presupuesto en POS</RouterLink>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <p v-if="success" class="success" role="status">{{ success }}</p>
  <section class="panel">
    <div v-if="loading" class="empty-small"><LoaderCircle class="spin" />Cargando presupuestos…</div>
    <div v-else class="responsive-table">
      <table>
        <thead><tr><th>Cliente</th><th>Total cotizado</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          <tr v-for="quote in rows" :key="quote.id">
            <td data-label="Cliente">{{ quote.customer }}</td>
            <td data-label="Total cotizado">{{ money(quote.totalAmount) }}</td>
            <td data-label="Vencimiento">{{ dateTime(quote.expiresAtUtc) }}</td>
            <td data-label="Estado"><span :class="isCurrent(quote) ? 'status success-status' : 'status danger'">{{ statusLabel(quote) }}</span></td>
            <td data-label="Acciones">
              <div v-if="isCurrent(quote)" class="invoice-actions">
                <button title="Cargar presupuesto en POS" :aria-label="`Cargar presupuesto de ${quote.customer} en POS`" @click="loadInPos(quote)"><FilePenLine :size="16" /></button>
                <button title="Anular presupuesto" :aria-label="`Anular presupuesto de ${quote.customer}`" :disabled="cancelingId === quote.id" @click="cancel(quote)"><LoaderCircle v-if="cancelingId === quote.id" class="spin" :size="16" /><Ban v-else :size="16" /></button>
              </div>
              <span v-else class="muted">Sin acciones</span>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5"><p class="empty-small">Todavía no hay presupuestos. Prepará uno desde el POS.</p></td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
