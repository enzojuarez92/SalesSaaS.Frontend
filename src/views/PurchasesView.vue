<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  Plus,
  PackageCheck,
  LoaderCircle,
  Trash2,
  Truck,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { money, dateTime } from "../services/format";
import CurrencyInput from "../components/CurrencyInput.vue";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { Product, PagedResult } from "../types/api";
const auth = useAuthStore(),
  tenant = useTenantStore();
type Supplier = {
  id: string;
  legalName: string;
  taxId: string;
  taxCondition: string;
  email: string;
  phone?: string;
  address?: string;
  isActive: boolean;
};
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
  error = ref(""),
  suppliers = ref<Supplier[]>([]),
  products = ref<Product[]>([]),
  orders = ref<Purchase[]>([]),
  brands = ref<Array<{ id: string; name: string }>>([]),
  brand = ref(""),
  supplierId = ref(""),
  editingSupplier = ref<Supplier | null>(null);
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
async function run(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await fn();
  } catch (e) {
    error.value = apiError(e);
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
  const [o, s, p, b] = await Promise.all([
    api.get<Purchase[]>("/purchases/orders"),
    api.get<Supplier[]>("/suppliers", { params }),
    api.get<PagedResult<Product>>("/products", { params }),
    api.get<Array<{ id: string; name: string }>>("/brands", { params }),
  ]);
  orders.value = o.data;
  suppliers.value = s.data;
  products.value = p.data.items;
  brands.value = b.data;
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
  });
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
  });
}
async function createSupplier() {
  await run(async () => {
    if (editingSupplier.value) await api.put(`/suppliers/${editingSupplier.value.id}`, { tenantId: auth.tenantId, id: editingSupplier.value.id, ...supplier });
    else await api.post("/suppliers", { tenantId: auth.tenantId, ...supplier });
    resetSupplier();
    await load();
  });
}
function resetSupplier(target?: Supplier) { editingSupplier.value = target || null; supplier.legalName = target?.legalName || ""; supplier.taxId = target?.taxId || ""; supplier.taxCondition = target?.taxCondition || "Responsable Inscripto"; supplier.email = target?.email || ""; supplier.phone = target?.phone || ""; supplier.address = target?.address || ""; supplier.isActive = target?.isActive ?? true; }
async function createBrand() {
  await run(async () => {
    await api.post("/brands", { tenantId: auth.tenantId, name: brand.value });
    brand.value = "";
    await load();
  });
}
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
  });
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
    <button @click="tab = 'orders'">Compras</button
    ><button @click="tab = 'suppliers'">Proveedores</button
    ><button @click="tab = 'brands'">Marcas</button>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <p v-if="busy" role="status"><LoaderCircle class="spin" /> Procesando…</p>
  <section v-if="tab === 'orders'" class="panel">
    <h2>Nueva orden de compra</h2>
    <form novalidate @submit.prevent="create">
      <label
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
      >
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
    <div class="section-heading"><h2>{{ editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2><button v-if="editingSupplier" type="button" class="secondary" @click="resetSupplier()">Cancelar edición</button></div>
    <form
      v-if="['Owner', 'Admin'].includes(auth.user?.role || '')"
      novalidate
      @submit.prevent="createSupplier"
    >
      <div class="form-grid">
        <label
          >Razón social<input
            v-model.trim="supplier.legalName"
            required
            maxlength="150" /></label
        ><label
          >CUIT<input
            v-model="supplier.taxId"
            required
            inputmode="numeric"
            pattern="[0-9]{11}"
            maxlength="11" /></label
        ><label>Email<input v-model.trim="supplier.email" type="email" /></label
        ><label>Teléfono<input v-model.trim="supplier.phone" maxlength="30" /></label
        ><label class="wide-field">Dirección<input v-model.trim="supplier.address" maxlength="300" /></label
        ><label
          >Condición fiscal<select v-model="supplier.taxCondition">
            <option>Responsable Inscripto</option>
            <option>Monotributo</option>
            <option>Exento</option>
          </select></label
        >
      </div>
      <label v-if="editingSupplier" class="check-row"><input v-model="supplier.isActive" type="checkbox" /><span>Proveedor activo</span></label>
      <button class="primary" :disabled="busy">{{ editingSupplier ? 'Guardar proveedor' : 'Crear proveedor' }}</button>
    </form>
    <div class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>CUIT</th>
            <th>Contacto</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Cuenta</th>
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
              <button v-if="['Owner', 'Admin'].includes(auth.user?.role || '')" class="secondary" :disabled="busy" @click="resetSupplier(s)">Editar</button>
              <button
                v-if="['Owner', 'Admin'].includes(auth.user?.role || '')"
                class="secondary"
                :disabled="busy"
                @click="
                  run(async () => {
                    statement = (
                      await api.get(`/suppliers/${s.id}/account`, {
                        params: { tenantId: auth.tenantId },
                      })
                    ).data;
                  })
                "
              >
                Ver movimientos
              </button>
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
  <section v-if="tab === 'brands'" class="panel">
    <h2>Marcas del catálogo</h2>
    <form novalidate @submit.prevent="createBrand">
      <label
        >Nombre<input v-model.trim="brand" required maxlength="100" /></label
      ><button class="primary" :disabled="busy">Crear marca</button>
    </form>
    <ul>
      <li v-for="b in brands" :key="b.id">{{ b.name }}</li>
    </ul>
    <p v-if="!brands.length">Todavía no hay marcas cargadas.</p>
  </section>
</template>
<style scoped>
.purchase-line {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 0.7rem;
  align-items: end;
  margin: 0.8rem 0;
}
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
