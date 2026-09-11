<script setup lang="ts">
import { download } from "../services/download";
import { money } from "../services/format";
import { computed, reactive, ref, watch } from "vue";
import {
  CircleDollarSign,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { AccountEntry, Customer, PagedResult } from "../types/api";
import {
  digitsOnly,
  isValidArgentineTaxId,
  isValidEmail,
  nonNegative,
  requiredText,
} from "../utils/validation";
const auth = useAuthStore(),
  tenant = useTenantStore();
const customers = ref<Customer[]>([]),
  search = ref(""),
  loading = ref(false),
  saving = ref(false),
  error = ref(""),
  success = ref(""),
  page = ref(1),
  totalPages = ref(1);
const showForm = ref(false),
  showStatement = ref(false),
  selected = ref<Customer | null>(null),
  entries = ref<AccountEntry[]>([]),
  statementLoading = ref(false),
  paymentAmount = ref(0),
  paymentDescription = ref("");
const form = reactive({
  id: "",
  name: "",
  documentType: "DNI",
  documentNumber: "",
  taxCondition: "Consumidor Final",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  creditLimit: 0,
  allowCredit: false,
  isActive: true,
});

const availableCredit = (customer: Customer) =>
  Math.max(0, customer.creditLimit - customer.currentBalance);
const totalDebt = computed(() =>
  customers.value.reduce((sum, customer) => sum + customer.currentBalance, 0),
);
const documentLabel = computed(() =>
  form.documentType === "DNI" ? "DNI" : "CUIT / CUIL",
);
function clearForm() {
  Object.assign(form, {
    id: "",
    name: "",
    documentType: "DNI",
    documentNumber: "",
    taxCondition: "Consumidor Final",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    creditLimit: 0,
    allowCredit: false,
    isActive: true,
  });
}
function openNew() {
  clearForm();
  error.value = "";
  showForm.value = true;
}
function openEdit(customer: Customer) {
  Object.assign(form, customer);
  error.value = "";
  showForm.value = true;
}
function normalizeDocument() {
  form.documentNumber = digitsOnly(
    form.documentNumber,
    form.documentType === "DNI" ? 8 : 11,
  );
}
function validateForm() {
  const nameError = requiredText(form.name, "El nombre", 150);
  if (nameError) return nameError;
  if (form.documentType === "DNI" && !/^\d{8}$/.test(form.documentNumber))
    return "El DNI debe contener exactamente 8 dígitos.";
  if (
    form.documentType !== "DNI" &&
    !isValidArgentineTaxId(form.documentNumber)
  )
    return "El CUIT/CUIL debe tener 11 dígitos y ser válido.";
  if (form.email && !isValidEmail(form.email))
    return "Ingresá un email válido.";
  return nonNegative(form.creditLimit, "El límite de crédito");
}
async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<PagedResult<Customer>>("/customers", {
      params: {
        tenantId: auth.tenantId,
        warehouseId: tenant.activeWarehouseId || undefined,
        searchTerm: search.value || undefined,
        isActive: true,
        pageNumber: page.value,
        pageSize: 12,
      },
    });
    customers.value = data.items;
    totalPages.value = data.totalPages;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (saving.value) return;
  const validation = validateForm();
  if (validation) {
    error.value = validation;
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const payload = { ...form, tenantId: auth.tenantId, legalName: form.name };
    if (form.id) await api.put(`/customers/${form.id}`, payload);
    else await api.post("/customers", payload);
    showForm.value = false;
    success.value = form.id ? "Cliente actualizado." : "Cliente creado.";
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
async function openStatement(customer: Customer) {
  selected.value = customer;
  entries.value = [];
  paymentAmount.value = 0;
  paymentDescription.value = "";
  showStatement.value = true;
  statementLoading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<{
      entries: AccountEntry[];
      currentBalance: number;
    }>(`/customers/${customer.id}/statement`, {
      params: {
        tenantId: auth.tenantId,
        warehouseId: tenant.activeWarehouseId || undefined,
      },
    });
    entries.value = data.entries;
    if (selected.value?.id === customer.id)
      selected.value = { ...customer, currentBalance: data.currentBalance };
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    statementLoading.value = false;
  }
}
async function recordPayment() {
  if (saving.value) return;
  if (!selected.value || !tenant.activeWarehouseId) {
    error.value = "Elegí un depósito antes de registrar el cobro.";
    return;
  }
  const descriptionError = requiredText(
    paymentDescription.value,
    "La descripción",
    300,
  );
  if (
    !paymentAmount.value ||
    paymentAmount.value > selected.value.currentBalance ||
    descriptionError
  ) {
    error.value =
      descriptionError ||
      "El pago debe ser mayor a cero y no superar el saldo pendiente de esta sucursal.";
    return;
  }
  saving.value = true;
  try {
    await api.post(`/customers/${selected.value.id}/payments`, {
      tenantId: auth.tenantId,
      customerId: selected.value.id,
      warehouseId: tenant.activeWarehouseId,
      amount: paymentAmount.value,
      description: paymentDescription.value,
    });
    success.value = "Pago registrado en la cuenta corriente.";
    await openStatement(selected.value);
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
let debounce: number | undefined;
watch(search, () => {
  page.value = 1;
  window.clearTimeout(debounce);
  debounce = window.setTimeout(load, 250);
});
watch(() => auth.tenantId, load, { immediate: true });
watch(
  () => tenant.activeWarehouseId,
  () => {
    showStatement.value = false;
    selected.value = null;
    void load();
  },
);
</script>
<template>
  <button
    class="secondary"
    @click="
      download(
        '/inventory-tools/export/accounts',
        'CuentasCorrientes.xlsx',
      ).catch((e) => (error = apiError(e)))
    "
  >
    Exportar cuentas a Excel
  </button>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Clientes</div>
      <h1>Clientes y cuentas corrientes</h1>
      <p>
        Gestioná datos, crédito disponible y cobros de
        {{
          tenant.warehouses.find((w) => w.id === tenant.activeWarehouseId)
            ?.name || "todas las sucursales"
        }}.
      </p>
    </div>
    <button class="primary" @click="openNew">
      <Plus :size="17" />Nuevo cliente
    </button>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <p v-if="success" class="success" role="status">{{ success }}</p>
  <div class="account-summary">
    <article>
      <span class="finance-icon orange"><CircleDollarSign /></span>
      <div>
        <p>Saldo pendiente</p>
        <strong>{{ money(totalDebt) }}</strong>
      </div>
    </article>
    <article>
      <span class="finance-icon green"><UserRound /></span>
      <div>
        <p>Clientes activos</p>
        <strong>{{ customers.length }}</strong>
      </div>
    </article>
  </div>
  <section class="panel">
    <div class="inventory-toolbar">
      <label class="search-input"
        ><Search :size="17" /><input
          v-model="search"
          placeholder="Buscar por nombre, CUIT o DNI" /></label
      ><span class="muted">{{ customers.length }} resultados</span>
    </div>
    <div v-if="loading" class="empty-small">
      <LoaderCircle class="spin" /> Cargando clientes…
    </div>
    <div v-else-if="!customers.length" class="empty-state compact">
      <UserRound :size="34" />
      <h2>No hay clientes</h2>
      <p>Creá el primero para utilizarlo en el punto de venta.</p>
    </div>
    <div v-else class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Documento</th>
            <th>Saldo</th>
            <th>Crédito disponible</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in customers" :key="customer.id">
            <td data-label="Cliente">
              <strong>{{ customer.name }}</strong
              ><small>{{ customer.email || "Sin email" }}</small>
            </td>
            <td data-label="Documento">
              {{ customer.documentType }} {{ customer.documentNumber }}
            </td>
            <td data-label="Saldo">
              <span
                class="customer-balance"
                :class="{ overdue: customer.currentBalance > 0 }"
                >{{ money(customer.currentBalance) }}</span
              >
            </td>
            <td data-label="Disponible">
              <span
                :class="
                  customer.allowCredit ? 'success-status status' : 'status'
                "
                >{{
                  customer.allowCredit
                    ? money(availableCredit(customer))
                    : "No habilitado"
                }}</span
              >
            </td>
            <td data-label="Acciones">
              <div class="invoice-actions">
                <button
                  title="Ver estado de cuenta"
                  @click="openStatement(customer)"
                >
                  <WalletCards :size="16" /></button
                ><button title="Editar cliente" @click="openEdit(customer)">
                  <Pencil :size="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="secondary"
        :disabled="page === 1"
        @click="
          page--;
          load();
        "
      >
        Anterior</button
      ><span>Página {{ page }} de {{ totalPages }}</span
      ><button
        class="secondary"
        :disabled="page === totalPages"
        @click="
          page++;
          load();
        "
      >
        Siguiente
      </button>
    </div>
  </section>
  <div v-if="showForm" class="modal-backdrop" @click.self="showForm = false">
    <section class="modal product-modal">
      <button class="icon-button modal-close" @click="showForm = false">
        <X />
      </button>
      <h2>{{ form.id ? "Editar cliente" : "Nuevo cliente" }}</h2>
      <form @submit.prevent="save">
        <div class="form-grid">
          <label class="wide"
            >Nombre / razón social<input
              v-model.trim="form.name"
              maxlength="150"
              required /></label
          ><label
            >Tipo de documento<select
              v-model="form.documentType"
              @change="form.documentNumber = ''"
            >
              <option>DNI</option>
              <option>CUIT</option>
              <option>CUIL</option>
            </select></label
          ><label
            >{{ documentLabel
            }}<input
              v-model="form.documentNumber"
              inputmode="numeric"
              @input="normalizeDocument"
              required /></label
          ><label
            >Correo electrónico<input
              v-model.trim="form.email"
              type="email" /></label
          ><label>Teléfono<input v-model.trim="form.phone" /></label
          ><label class="wide"
            >Dirección<input v-model.trim="form.address" /></label
          ><label
            >Límite de crédito<input
              v-model.number="form.creditLimit"
              type="number"
              min="0"
              step="0.01" /></label
          ><label class="credit-toggle"
            ><input v-model="form.allowCredit" type="checkbox" /><span
              ><strong>Habilitar cuenta corriente</strong
              ><small
                >Permite registrar ventas fiadas hasta el límite
                indicado.</small
              ></span
            ></label
          >
        </div>
        <button class="primary full" :disabled="saving">
          <LoaderCircle v-if="saving" class="spin" :size="16" />{{
            saving ? "Guardando…" : "Guardar cliente"
          }}
        </button>
      </form>
    </section>
  </div>
  <div
    v-if="showStatement && selected"
    class="modal-backdrop"
    @click.self="showStatement = false"
  >
    <section class="modal statement-modal">
      <button class="icon-button modal-close" @click="showStatement = false">
        <X />
      </button>
      <h2>Cuenta de {{ selected.name }}</h2>
      <div class="statement-summary">
        <span
          >Saldo pendiente<strong>{{
            money(selected.currentBalance)
          }}</strong></span
        ><span
          >Crédito disponible<strong>{{
            money(availableCredit(selected))
          }}</strong></span
        >
      </div>
      <div v-if="statementLoading" class="empty-small">
        <LoaderCircle class="spin" /> Cargando movimientos…
      </div>
      <div v-else class="statement-list">
        <article v-for="entry in entries" :key="entry.id">
          <span
            :class="
              entry.type === 1 ? 'status danger' : 'status success-status'
            "
            >{{ entry.type === 1 ? "Debe" : "Pago" }}</span
          >
          <div>
            <strong>{{ entry.description }}</strong
            ><small>{{
              new Date(entry.occurredAtUtc).toLocaleDateString("es-AR")
            }}</small>
          </div>
          <strong>{{ money(entry.amount) }}</strong>
        </article>
        <p v-if="!entries.length" class="empty-small">
          Sin movimientos todavía.
        </p>
      </div>
      <form class="payment-form" @submit.prevent="recordPayment">
        <h3>Registrar entrega de dinero</h3>
        <label
          >Importe<input
            v-model.number="paymentAmount"
            type="number"
            min="0.01"
            step="0.01" /></label
        ><label
          >Descripción<input
            v-model.trim="paymentDescription"
            maxlength="300"
            placeholder="Ej. Pago en efectivo" /></label
        ><button class="primary full" :disabled="saving">Registrar pago</button>
      </form>
    </section>
  </div>
</template>
<style scoped>
.credit-toggle {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 64px;
  padding: 0.75rem 0.9rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #fff;
  cursor: pointer;
}
.credit-toggle input {
  width: 1.15rem;
  height: 1.15rem;
  min-width: 1.15rem;
  margin: 0;
  padding: 0;
  accent-color: #ec4899;
}
.credit-toggle span {
  display: grid;
  gap: 0.15rem;
  color: #0f172a;
}
.credit-toggle small {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 400;
}
@media (max-width: 640px) {
  .credit-toggle {
    grid-column: span 1;
  }
}
</style>
