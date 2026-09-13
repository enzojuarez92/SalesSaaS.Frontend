<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  Plus,
  PackageCheck,
  LoaderCircle,
  Trash2,
  Truck,
  Pencil,
  ScrollText,
  Save,
  X,
} from "lucide-vue-next";
import { api, apiError, notify } from "../services/api";
import { money, dateTime } from "../services/format";
import CurrencyInput from "../components/CurrencyInput.vue";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { Product, PagedResult, Supplier } from "../types/api";
const auth = useAuthStore(),
  tenant = useTenantStore();
type Purchase = {
  id: string;
  supplierId: string;
  status: string;
  totalAmount: number;
  createdAtUtc: string;
  invoiced: boolean;
};
const tab = ref("orders"),
  busy = ref(false),
  suppliers = ref<Supplier[]>([]),
  products = ref<Product[]>([]),
  orders = ref<Purchase[]>([]),
  supplierId = ref(""),
  editingSupplier = ref<Supplier | null>(null),
  showSupplierModal = ref(false),
  selectCreatedSupplier = ref(false);
const supplier = reactive({
  legalName: "",
  taxId: "",
  taxCondition: "Responsable Inscripto",
  email: "",
  phone: "",
  address: "",
  isActive: true,
});
const lines = ref<
  Array<{ productId: string; quantity: number; unitCost: number }>
>([{ productId: "", quantity: 1, unitCost: 0 }]);
const total = computed(() =>
  lines.value.reduce((a, l) => a + l.quantity * l.unitCost, 0),
);
const invoice = reactive({ orderId: "", number: "" });
const statement = ref<
  Array<{
    id: string;
    amount: number;
    isDebit: boolean;
    description: string;
    occurredAtUtc: string;
  }>
>([]);
async function run(fn: () => Promise<unknown>, successMessage?: string) {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
    if (successMessage) notify(successMessage);
  } catch (e) {
    notify(apiError(e), true);
  } finally {
    busy.value = false;
  }
}
async function load() {
  const params = {
    tenantId: auth.tenantId,
    warehouseId: tenant.activeWarehouseId,
    pageSize: 100,
  };
  const [o, s, p] = await Promise.all([
    api.get<Purchase[]>("/purchases/orders"),
    api.get<Supplier[]>("/suppliers", { params }),
    api.get<PagedResult<Product>>("/products", { params }),
  ]);
  orders.value = o.data;
  suppliers.value = s.data;
  products.value = p.data.items;
}
async function create() {
  await run(async () => {
    await api.post("/purchases/orders", {
      tenantId: auth.tenantId,
      warehouseId: tenant.activeWarehouseId,
      supplierId: supplierId.value,
      items: lines.value,
    });
    lines.value = [{ productId: "", quantity: 1, unitCost: 0 }];
    await load();
  }, "Orden de compra guardada.");
}
async function receive(order: Purchase) {
  if (
    !window.confirm(
      "¿Confirmás que recibiste todos los productos? Esta acción aumenta el stock de la sucursal activa.",
    )
  )
    return;
  await run(async () => {
    await api.post(`/purchases/orders/${order.id}/receive`, {
      tenantId: auth.tenantId,
      purchaseOrderId: order.id,
    });
    await load();
  }, "Mercadería recibida y stock actualizado.");
}
async function createSupplier() {
  const isEditing = Boolean(editingSupplier.value);
  await run(async () => {
    let createdId = "";
    if (editingSupplier.value) await api.put(`/suppliers/${editingSupplier.value.id}`, { tenantId: auth.tenantId, id: editingSupplier.value.id, ...supplier });
    else createdId = (await api.post<{ id: string }>("/suppliers", { tenantId: auth.tenantId, ...supplier })).data.id;
    resetSupplier();
    await load();
    if (selectCreatedSupplier.value && createdId) supplierId.value = createdId;
    showSupplierModal.value = false;
    selectCreatedSupplier.value = false;
  }, isEditing ? "Proveedor actualizado." : "Proveedor creado.");
}
function resetSupplier(target?: Supplier) { editingSupplier.value = target || null; supplier.legalName = target?.legalName || ""; supplier.taxId = target?.taxId || ""; supplier.taxCondition = target?.taxCondition || "Responsable Inscripto"; supplier.email = target?.email || ""; supplier.phone = target?.phone || ""; supplier.address = target?.address || ""; supplier.isActive = target?.isActive ?? true; }
function openSupplier(target?: Supplier, assignAfterCreate = false) { resetSupplier(target); selectCreatedSupplier.value = !target && assignAfterCreate; showSupplierModal.value = true; }
async function viewStatement(target: Supplier) { await run(async () => { statement.value = (await api.get(`/suppliers/${target.id}/account`, { params: { tenantId: auth.tenantId } })).data; }, undefined); }
async function invoicePurchase() {
  await run(async () => {
    await api.post("/purchases/invoices", {
      tenantId: auth.tenantId,
      purchaseOrderId: invoice.orderId,
      number: invoice.number,
    });
    invoice.orderId = "";
    invoice.number = "";
    await load();
  }, "Factura de compra registrada.");
}
onMounted(() => run(load));
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>Compras y proveedores</h1>
      <p>
        Registrá las compras y recibí mercadería en
        {{
          tenant.warehouses.find((w) => w.id === tenant.activeWarehouseId)
            ?.name
        }}.
      </p>
    </div>
    <Truck />
  </div>
  <div class="tabs">
    <button type="button" :class="{ active: tab === 'orders' }" @click="tab = 'orders'">Compras</button
    ><button type="button" :class="{ active: tab === 'suppliers' }" @click="tab = 'suppliers'">Proveedores</button
    >
  </div>
  <p v-if="busy" role="status"><LoaderCircle class="spin" /> Procesando…</p>
  <section v-if="tab === 'orders'" class="panel">
    <h2>Nueva orden de compra</h2>
    <form novalidate @submit.prevent="create">
      <div class="supplier-picker"><label
        >Proveedor<select v-model="supplierId" required>
          <option value="" disabled>Seleccionar proveedor</option>
          <option
            v-for="s in suppliers.filter((s) => s.isActive)"
            :key="s.id"
            :value="s.id"
          >
            {{ s.legalName }}
          </option>
        </select></label
      ><button type="button" class="secondary" @click="openSupplier(undefined, true)"><Plus :size="16" />Nuevo proveedor</button></div>
      <div v-for="(line, i) in lines" :key="i" class="purchase-line">
        <label
          >Producto<select
            v-model="line.productId"
            required
            @change="
              line.unitCost =
                products.find((p) => p.id === line.productId)?.cost || 0
            "
          >
            <option value="" disabled>Seleccionar producto</option>
            <option v-for="p in products" :key="p.id" :value="p.id">
              {{ p.sku }} · {{ p.name }}
            </option>
          </select></label
        ><label
          >Unidades<input
            v-model.number="line.quantity"
            type="number"
            required
            min="1"
            step="1" /></label
        ><label
          >Costo unitario<CurrencyInput
            v-model="line.unitCost"
            :min="0" /></label
        ><button
          type="button"
          class="icon-button"
          aria-label="Quitar línea"
          :disabled="lines.length === 1"
          @click="lines.splice(i, 1)"
        >
          <Trash2 :size="16" />
        </button>
      </div>
      <div class="section-heading">
        <button
          type="button"
          class="secondary"
          @click="lines.push({ productId: '', quantity: 1, unitCost: 0 })"
        >
          <Plus :size="16" />Agregar línea</button
        ><strong>{{ money(total) }}</strong
        ><button class="primary" :disabled="busy">Guardar orden</button>
      </div>
    </form>
    <h2>Órdenes de la sucursal</h2>
    <div class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td>{{ dateTime(o.createdAtUtc) }}</td>
            <td>
              {{ suppliers.find((s) => s.id === o.supplierId)?.legalName }}
            </td>
            <td>{{ money(o.totalAmount) }}</td>
            <td>
              {{ o.status === "Draft" ? "Pendiente de recepción" : "Recibida" }}
            </td>
            <td>
              <button
                v-if="o.status === 'Draft'"
                class="secondary"
                :disabled="busy"
                @click="receive(o)"
              >
                <PackageCheck :size="16" />Recibir mercadería</button
              ><button
                v-else-if="!o.invoiced"
                class="secondary"
                @click="invoice.orderId = o.id"
              >
                Registrar factura</button
              ><span v-else class="status success-status">Facturada</span>
            </td>
          </tr>
          <tr v-if="!orders.length">
            <td colspan="5">Todavía no hay compras en esta sucursal.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <form v-if="invoice.orderId" novalidate @submit.prevent="invoicePurchase">
      <label
        >Número de factura del proveedor<input
          v-model.trim="invoice.number"
          required
          maxlength="50"
          placeholder="0001-00000123" /></label
      ><button class="primary" :disabled="busy">
        Registrar factura de compra
      </button>
    </form>
  </section>
  <section v-if="tab === 'suppliers'" class="panel">
    <div class="section-heading"><div><h2>Proveedores</h2><p class="muted">Administrá los datos comerciales y consultá los movimientos de cuenta.</p></div><button v-if="['Owner', 'Admin'].includes(auth.user?.role || '')" class="primary" @click="openSupplier()"><Plus :size="16" />Nuevo proveedor</button></div>
    <div class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>CUIT</th>
            <th>Contacto</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in suppliers" :key="s.id">
            <td>{{ s.legalName }}</td>
            <td>{{ s.taxId }}</td>
            <td>{{ s.phone || 'Sin teléfono' }}<small>{{ s.address || 'Sin dirección' }}</small></td>
            <td>{{ s.email }}</td>
            <td><span :class="s.isActive ? 'status success-status' : 'status danger'">{{ s.isActive ? 'Activo' : 'Inactivo' }}</span></td>
            <td>
              <div class="invoice-actions"><button v-if="['Owner', 'Admin'].includes(auth.user?.role || '')" :disabled="busy" title="Editar proveedor" :aria-label="`Editar ${s.legalName}`" @click="openSupplier(s)"><Pencil :size="16" /></button>
              <button
                v-if="['Owner', 'Admin'].includes(auth.user?.role || '')"
                :disabled="busy"
                title="Ver movimientos de cuenta"
                :aria-label="`Ver movimientos de ${s.legalName}`"
                @click="viewStatement(s)"
              ><ScrollText :size="16" /></button></div>
            </td>
          </tr>
          <tr v-if="!suppliers.length">
            <td colspan="6">Creá un proveedor para comenzar a comprar.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <article v-for="entry in statement" :key="entry.id" class="section-heading">
      <span>{{ dateTime(entry.occurredAtUtc) }} · {{ entry.description }}</span
      ><strong>{{ money(entry.amount) }}</strong>
    </article>
  </section>
  <div v-if="showSupplierModal" class="modal-backdrop"><section class="modal supplier-modal"><button class="icon-button modal-close" aria-label="Cerrar" @click="showSupplierModal = false"><X /></button><h2>{{ editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2><p>Completá los datos comerciales del proveedor.</p><form novalidate @submit.prevent="createSupplier"><div class="form-grid"><label>Razón social<input v-model.trim="supplier.legalName" required maxlength="150" autofocus /></label><label>CUIT<input v-model="supplier.taxId" required inputmode="numeric" pattern="[0-9]{11}" maxlength="11" /></label><label>Email<input v-model.trim="supplier.email" type="email" /></label><label>Teléfono<input v-model.trim="supplier.phone" maxlength="30" /></label><label class="wide-field">Dirección<input v-model.trim="supplier.address" maxlength="300" /></label><label>Condición fiscal<select v-model="supplier.taxCondition"><option>Responsable Inscripto</option><option>Monotributo</option><option>Exento</option></select></label></div><label v-if="editingSupplier" class="supplier-active"><input v-model="supplier.isActive" type="checkbox" /><span><strong>Proveedor activo</strong><small>Podrá seleccionarse al crear nuevas órdenes de compra.</small></span></label><div class="modal-actions"><button type="button" class="secondary" @click="showSupplierModal = false">Cancelar</button><button class="primary" :disabled="busy"><Save :size="16" />{{ busy ? 'Guardando…' : 'Guardar proveedor' }}</button></div></form></section></div>
</template>
<style scoped>
.purchase-line {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 0.7rem;
  align-items: end;
  margin: 0.8rem 0;
}
.tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.tabs button{padding:.6rem 1rem;border:1px solid #e2e8f0;border-radius:.6rem;background:#fff}.tabs button.active{background:#ec4899;color:#fff;border-color:#ec4899}.supplier-picker{display:flex;align-items:end;gap:.75rem}.supplier-picker label{flex:1}
.supplier-active{display:flex;align-items:center;gap:.75rem;min-height:4.5rem;padding:.8rem 1rem;margin:.8rem 0;border:1px solid #e2e8f0;border-radius:.8rem;cursor:pointer}.supplier-active input{width:1.15rem;height:1.15rem;margin:0;accent-color:#ec4899}.supplier-active span{display:grid;gap:.2rem}.supplier-active small{color:#64748b}.supplier-modal{width:min(100%,42rem)}.modal-actions{display:flex;justify-content:flex-end;gap:.65rem;margin-top:1rem}
h2 {
  margin: 1rem 0;
}
.section-heading {
  flex-wrap: wrap;
  gap: 0.75rem;
}
.wide-field{grid-column:span 2}.responsive-table small{display:block;color:#64748b;margin-top:.2rem}
@media (max-width: 650px) {
  .purchase-line {
    grid-template-columns: 1fr 1fr;
  }
  .purchase-line > label:first-child {
    grid-column: 1/-1;
  }
  .wide-field{grid-column:span 1}
}
</style>
