<script setup lang="ts">
import { ref, watch } from "vue";
import { Download, Upload, History, X, LoaderCircle } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { download } from "../services/download";
import { dateTime, number } from "../services/format";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
const props = defineProps<{
  productId?: string;
  productName?: string;
  compact?: boolean;
}>();
const emit = defineEmits<{ updated: [] }>();
const tenant = useTenantStore();
const busy = ref(false),
  error = ref(""),
  message = ref(""),
  show = ref(false),
  page = ref(1),
  count = ref(0);
const rows = ref<
  Array<{
    id: string;
    occurredAtUtc: string;
    type: number;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    user: string;
    warehouse: string;
    reason: string;
  }>
>([]);
const errors = ref<Array<{ row: number; message: string }>>([]);
const auth = useAuthStore(),
  destination = ref(""),
  quantity = ref(1),
  reference = ref("");
async function transfer() {
  await run(async () => {
    await api.post("/stock-movements/transfer", {
      tenantId: auth.tenantId,
      productId: props.productId,
      sourceWarehouseId: tenant.activeWarehouseId,
      destinationWarehouseId: destination.value,
      quantity: quantity.value,
      reference: reference.value,
    });
    show.value = false;
    emit("updated");
  });
}
const types: Record<number, string> = {
  1: "Entrada / compra",
  2: "Salida / venta",
  3: "Ajuste positivo",
  4: "Ajuste negativo",
  5: "Transferencia saliente",
  6: "Transferencia entrante",
};
async function run(action: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await action();
  } catch (e) {
    error.value = apiError(e);
  } finally {
    busy.value = false;
  }
}
async function ledger() {
  await run(async () => {
    const { data } = await api.get(
      `/inventory-tools/products/${props.productId}/kardex`,
      { params: { page: page.value } },
    );
    rows.value = data.items;
    count.value = data.totalCount;
    show.value = true;
  });
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await run(async () => {
    const body = new FormData();
    body.append("file", file);
    const { data } = await api.post("/inventory-tools/products/import", body, {
      timeout: 120000,
    });
    errors.value = data.errors;
    message.value = `${data.message} Productos importados: ${data.imported}.`;
    if (data.imported) emit("updated");
  });
  input.value = "";
}
watch(
  () => tenant.activeWarehouseId,
  () => {
    show.value = false;
    rows.value = [];
    message.value = "";
    errors.value = [];
  },
);
</script>
<template>
  <div class="inventory-tools" :class="{ compact: props.compact }">
    <button
      v-if="productId"
      class="secondary"
      :disabled="busy"
      @click="
        page = 1;
        ledger();
      "
      :class="{ 'icon-action': props.compact }"
      :title="props.compact ? 'Ver Kardex' : undefined"
      :aria-label="props.compact ? 'Ver Kardex' : undefined"
    >
      <History :size="16" /><span v-if="!props.compact">Kardex</span></button
    ><template v-else
      ><button
        class="secondary"
        :disabled="busy"
        @click="
          run(() =>
            download(
              '/inventory-tools/products/template',
              'Plantilla_Productos.xlsx',
            ),
          )
        "
      >
        <Download :size="16" />Plantilla</button
      ><label class="secondary upload-label"
        ><Upload :size="16" />Importar Excel<input
          type="file"
          accept=".xlsx"
          :disabled="busy"
          @change="upload" /></label
      ><button
        class="secondary"
        :disabled="busy"
        @click="
          run(() =>
            download('/inventory-tools/export/products', 'Productos.xlsx'),
          )
        "
      >
        <Download :size="16" />Productos</button
      ><button
        class="secondary"
        :disabled="busy"
        @click="
          run(() =>
            download('/inventory-tools/export/inventory', 'Inventario.xlsx'),
          )
        "
      >
        <Download :size="16" />Inventario</button
      ><small
        >Hasta 1000 filas. El stock inicial se asigna a la sucursal activa. Si
        hay errores no se importa ninguna fila.</small
      ></template
    ><LoaderCircle v-if="busy" class="spin" />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p
      v-if="message"
      :class="errors.length ? 'error' : 'success'"
      role="status"
    >
      {{ message }}
    </p>
    <ul v-if="errors.length">
      <li v-for="e in errors" :key="e.row">
        Fila {{ e.row }}: {{ e.message }}
      </li>
    </ul>
  </div>
  <div v-if="show" class="modal-backdrop">
    <section class="modal" style="width: min(95vw, 70rem); max-width: 70rem">
      <button
        class="icon-button modal-close"
        aria-label="Cerrar Kardex"
        @click="show = false"
      >
        <X />
      </button>
      <h2>Kardex · {{ productName }}</h2>
      <p>
        Movimientos de la sucursal activa. Los saldos históricos se reconstruyen
        desde el registro disponible.
      </p>
      <div class="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Fecha / sucursal</th>
              <th>Movimiento</th>
              <th>Cantidad</th>
              <th>Anterior</th>
              <th>Resultante</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id">
              <td>
                {{ dateTime(r.occurredAtUtc) }}<small>{{ r.warehouse }}</small>
              </td>
              <td>
                {{ types[r.type] || r.type }}<small>{{ r.reason }}</small>
              </td>
              <td
                :class="r.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ r.quantity > 0 ? "+" : "" }}{{ number(r.quantity) }}
              </td>
              <td>{{ number(r.stockBefore) }}</td>
              <td>{{ number(r.stockAfter) }}</td>
              <td>{{ r.user }}</td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="6">
                Este producto todavía no tiene movimientos en esta sucursal.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <form v-if="tenant.warehouses.length > 1" novalidate @submit.prevent="transfer">
        <h3>Transferir desde esta sucursal</h3>
        <div class="form-grid">
          <label
            >Destino<select v-model="destination" required>
              <option value="" disabled>Seleccionar depósito</option>
              <option
                v-for="w in tenant.warehouses.filter(
                  (w) => w.id !== tenant.activeWarehouseId,
                )"
                :value="w.id"
                :key="w.id"
              >
                {{ w.name }}
              </option>
            </select></label
          ><label
            >Unidades<input
              v-model.number="quantity"
              type="number"
              min="1"
              step="1"
              required /></label
          ><label
            >Referencia<input v-model.trim="reference" maxlength="100" required
          /></label>
        </div>
        <button class="primary" :disabled="busy">Transferir stock</button>
      </form>
      <div class="pagination">
        <button
          class="secondary"
          :disabled="busy || page === 1"
          @click="
            page--;
            ledger();
          "
        >
          Anterior</button
        ><span>{{ page }} / {{ Math.max(1, Math.ceil(count / 50)) }}</span
        ><button
          class="secondary"
          :disabled="busy || page * 50 >= count"
          @click="
            page++;
            ledger();
          "
        >
          Siguiente
        </button>
      </div>
    </section>
  </div>
</template>
<style scoped>
.inventory-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  margin: 0.5rem 0 1rem;
}
.inventory-tools > small,
.inventory-tools > p,
.inventory-tools > ul {
  flex-basis: 100%;
}
.upload-label {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.upload-label input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.inventory-tools.compact {
  margin: 0;
}
.inventory-tools.compact .icon-action {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  min-width: 31px;
  padding: 0;
}
</style>
