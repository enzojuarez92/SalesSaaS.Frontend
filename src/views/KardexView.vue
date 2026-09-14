<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ArrowLeftRight, Filter, LoaderCircle } from "lucide-vue-next";
import TablePaginator from "../components/TablePaginator.vue";
import { api, apiError, notify } from "../services/api";
import { dateTime, number } from "../services/format";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";

type KardexRow = {
  id: string;
  occurredAtUtc: string;
  type: number;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  user: string;
  warehouse: string;
  reason: string;
};

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tenant = useTenantStore();
const productId = computed(() => String(route.params.productId || ""));
const rows = ref<KardexRow[]>([]);
const productName = ref("");
const productSku = ref("");
const currentStock = ref(0);
const page = ref(1);
const pageSize = 15;
const count = ref(0);
const loading = ref(false);
const transferring = ref(false);
const error = ref("");
function inputDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const from = ref(inputDate(-14));
const to = ref(inputDate());
const movementType = ref("");
const destination = ref("");
const quantity = ref(1);
const reference = ref("");
const destinationError = ref("");
const quantityError = ref("");
const referenceError = ref("");
const showTransferConfirmation = ref(false);

const types: Record<number, string> = {
  1: "Entrada / compra",
  2: "Salida / venta",
  3: "Ajuste positivo",
  4: "Ajuste negativo",
  5: "Transferencia saliente",
  6: "Transferencia entrante",
};
const totalPages = computed(() => Math.max(1, Math.ceil(count.value / pageSize)));
const destinations = computed(() =>
  tenant.warehouses.filter((warehouse) => warehouse.id !== tenant.activeWarehouseId),
);
const activeWarehouseName = computed(() =>
  tenant.warehouses.find((warehouse) => warehouse.id === tenant.activeWarehouseId)?.name || "la sucursal activa",
);
const destinationName = computed(() =>
  destinations.value.find((warehouse) => warehouse.id === destination.value)?.name || "el depósito seleccionado",
);

function boundary(value: string, end: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`).toISOString();
}

async function load() {
  if (!productId.value || !tenant.activeWarehouseId) return;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get(`/inventory-tools/products/${productId.value}/kardex`, {
      params: {
        page: page.value,
        pageSize,
        fromUtc: boundary(from.value, false),
        toUtc: boundary(to.value, true),
        type: movementType.value || undefined,
      },
    });
    rows.value = data.items;
    count.value = data.totalCount;
    currentStock.value = data.currentStock;
    productName.value = data.product.name;
    productSku.value = data.product.sku;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}

function requestTransfer() {
  error.value = "";
  destinationError.value = "";
  quantityError.value = "";
  referenceError.value = "";
  if (!destination.value) {
    destinationError.value = "Seleccioná el depósito de destino.";
    return;
  }
  if (!Number.isInteger(quantity.value) || quantity.value < 1) {
    quantityError.value = "Ingresá una cantidad entera mayor a cero.";
    return;
  }
  if (!reference.value.trim()) {
    referenceError.value = "Ingresá una referencia para la transferencia.";
    return;
  }
  if (quantity.value > currentStock.value) {
    quantityError.value = "El depósito de origen no tiene stock suficiente para la transferencia.";
    return;
  }
  showTransferConfirmation.value = true;
}

async function transfer() {
  showTransferConfirmation.value = false;
  transferring.value = true;
  error.value = "";
  try {
    await api.post("/stock-movements/transfer", {
      tenantId: auth.tenantId,
      productId: productId.value,
      sourceWarehouseId: tenant.activeWarehouseId,
      destinationWarehouseId: destination.value,
      quantity: quantity.value,
      reference: reference.value,
    });
    destination.value = "";
    quantity.value = 1;
    reference.value = "";
    notify("Stock transferido correctamente.");
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    transferring.value = false;
  }
}

watch(
  [productId, () => tenant.activeWarehouseId],
  () => {
    page.value = 1;
    void load();
  },
  { immediate: true },
);

let filterTimer: number | undefined;
watch([from, to, movementType], () => {
  window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
});
</script>

<template>
  <div class="page-heading kardex-page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Inventario / Kardex</div>
      <h1>Kardex · {{ productName || "Producto" }}</h1>
      <p>Consultá los movimientos de stock de la sucursal activa y sus saldos históricos.</p>
    </div>
    <div class="kardex-heading-actions">
      <div class="current-stock">
        <span>Stock actual</span>
        <strong>{{ number(currentStock) }}</strong>
        <small>unidades</small>
      </div>
      <button class="secondary" @click="router.push({ name: 'products' })">
        <ArrowLeft :size="17" />Volver a productos
      </button>
    </div>
  </div>

  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <section class="panel kardex-filter-panel">
    <div class="section-title">
      <Filter :size="18" />
      <div><h2>Filtrar movimientos</h2><p>Acotá el historial por período o tipo de operación.</p></div>
    </div>
    <div class="form-grid kardex-filters">
      <label>Desde<input v-model="from" type="date" :max="to || undefined" /></label>
      <label>Hasta<input v-model="to" type="date" :min="from || undefined" /></label>
      <label>Movimiento<select v-model="movementType"><option value="">Todos los movimientos</option><option v-for="(label, value) in types" :key="value" :value="value">{{ label }}</option></select></label>
    </div>
  </section>

  <section class="panel kardex-table-panel">
    <div class="table-panel-heading"><div><h2>Movimientos de {{ productName || "producto" }}</h2><p v-if="productSku">{{ productSku }}</p></div></div>
    <div v-if="loading" class="empty-small"><LoaderCircle class="spin" />Actualizando Kardex…</div>
    <div v-else class="responsive-table">
      <table>
        <thead><tr><th>Fecha / sucursal</th><th>Movimiento</th><th>Cantidad</th><th>Anterior</th><th>Resultante</th><th>Responsable</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td data-label="Fecha / sucursal">{{ dateTime(row.occurredAtUtc) }}<small>{{ row.warehouse }}</small></td>
            <td data-label="Movimiento">{{ types[row.type] || row.type }}<small>{{ row.reason }}</small></td>
            <td data-label="Cantidad" :class="row.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'">{{ row.quantity > 0 ? "+" : "" }}{{ number(row.quantity) }}</td>
            <td data-label="Anterior">{{ number(row.stockBefore) }}</td>
            <td data-label="Resultante">{{ number(row.stockAfter) }}</td>
            <td data-label="Responsable">{{ row.user }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6">No hay movimientos que coincidan con los filtros seleccionados.</td></tr>
        </tbody>
      </table>
    </div>
    <TablePaginator :page="page" :total-pages="totalPages" :total-count="count" :shown-count="rows.length" :page-size="pageSize" @previous="page--; load()" @next="page++; load()" />
  </section>

  <section v-if="destinations.length" class="panel transfer-panel">
    <div class="section-title"><ArrowLeftRight :size="19" /><div><h2>Transferir stock</h2><p>Mové unidades desde {{ activeWarehouseName }} a otro depósito.</p></div></div>
    <form class="form-grid transfer-form" novalidate @submit.prevent="requestTransfer">
      <label class="transfer-field">Depósito de destino<select v-model="destination" required :aria-invalid="!!destinationError" @change="destinationError = ''"><option value="" disabled>Seleccionar depósito</option><option v-for="warehouse in destinations" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option></select><small v-if="destinationError" class="field-error" role="alert">{{ destinationError }}</small></label>
      <label class="transfer-field">Unidades<input v-model.number="quantity" type="number" min="1" step="1" required :aria-invalid="!!quantityError" @input="quantityError = ''" /><small v-if="quantityError" class="field-error" role="alert">{{ quantityError }}</small></label>
      <label class="transfer-field">Referencia<input v-model.trim="reference" maxlength="100" placeholder="Motivo o referencia" required :aria-invalid="!!referenceError" @input="referenceError = ''" /><small v-if="referenceError" class="field-error" role="alert">{{ referenceError }}</small></label>
      <div class="transfer-submit"><button class="primary" :disabled="transferring"><ArrowLeftRight :size="17" />{{ transferring ? "Transfiriendo…" : "Transferir stock" }}</button></div>
    </form>
  </section>

  <div v-if="showTransferConfirmation" class="modal-backdrop">
    <section class="modal transfer-confirmation" role="dialog" aria-modal="true" aria-labelledby="transfer-confirmation-title">
      <h2 id="transfer-confirmation-title">Confirmar transferencia</h2>
      <p>Estás por transferir <strong>{{ number(quantity) }} {{ quantity === 1 ? "unidad" : "unidades" }}</strong> de <strong>{{ productName }}</strong> desde <strong>{{ activeWarehouseName }}</strong> hacia <strong>{{ destinationName }}</strong>.</p>
      <p class="muted">El stock se actualizará en ambos depósitos al confirmar.</p>
      <div class="modal-actions"><button class="secondary" :disabled="transferring" @click="showTransferConfirmation = false">Cancelar</button><button class="primary" :disabled="transferring" @click="transfer"><ArrowLeftRight :size="17" />{{ transferring ? "Transfiriendo…" : "Confirmar transferencia" }}</button></div>
    </section>
  </div>
</template>

<style scoped>
.kardex-page-heading { align-items: flex-end; }
.kardex-heading-actions { display: flex; gap: .75rem; align-items: center; }
.current-stock { display: flex; align-items: baseline; gap: .4rem; min-width: max-content; padding: .8rem .95rem; white-space: nowrap; border: 1px solid #f9a8d4; border-radius: .75rem; background: #fdf2f8; }
.current-stock span { color: #9d174d; font-size: .72rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.current-stock strong { color: #be185d; font-size: 1.45rem; line-height: 1; }
.current-stock small { color: #9d174d; }
.kardex-filter-panel, .kardex-table-panel, .transfer-panel { margin-top: 1rem; }
.section-title { display: flex; gap: .65rem; align-items: flex-start; margin-bottom: 1rem; }
.section-title svg { color: #db2777; margin-top: .15rem; }
.section-title h2, .table-panel-heading h2 { margin: 0; font-size: 1.1rem; }
.section-title p, .table-panel-heading p { margin: .25rem 0 0; color: #64748b; font-size: .875rem; }
.kardex-filters { align-items: end; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.table-panel-heading { margin-bottom: 1rem; }
.transfer-form { align-items: end; grid-template-columns: 1.2fr .7fr 1.2fr auto; padding-bottom: 1.45rem; }
.transfer-field { position: relative; }
.transfer-field .field-error { position: absolute; top: calc(100% + .35rem); left: 0; white-space: nowrap; }
.transfer-submit { display: flex; align-items: end; }
.transfer-submit button { white-space: nowrap; }
.transfer-confirmation { width: min(92vw, 34rem); }.transfer-confirmation h2 { margin-top: 0; }.transfer-confirmation p { line-height: 1.55; }.modal-actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
@media (max-width: 900px) { .kardex-filters, .transfer-form { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .kardex-page-heading, .kardex-heading-actions { flex-direction: column; align-items: stretch; }.kardex-filters, .transfer-form { grid-template-columns: 1fr; }.transfer-submit button { width: 100%; }.modal-actions { flex-direction: column-reverse; }.modal-actions button { width: 100%; } }
</style>
