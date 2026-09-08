<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  LoaderCircle,
  Search,
  WalletCards,
  X,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import type {
  AccountEntry,
  Customer,
  PagedResult,
  Supplier,
} from "../types/api";
import { nonNegative, requiredText } from "../utils/validation";
const auth = useAuthStore();
const customers = ref<Customer[]>([]),
  suppliers = ref<Supplier[]>([]),
  selected = ref<{
    kind: "customer" | "supplier";
    id: string;
    name: string;
  } | null>(null),
  entries = ref<AccountEntry[]>([]);
const loading = ref(false),
  detailLoading = ref(false),
  error = ref(""),
  showMovement = ref(false),
  saving = ref(false);
const movement = ref({
  sessionId: "",
  amount: 0,
  description: "",
  paymentMethod: 1,
  isIncome: true,
});
const money = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    value,
  );
const customerBalance = (customer: Customer) =>
  customer.allowCredit ? customer.creditLimit : 0;
const totalReceivable = computed(() =>
  customers.value.reduce((sum, item) => sum + customerBalance(item), 0),
);
const totalPayable = computed(() => suppliers.value.length);
const selectedBalance = computed(() => {
  if (!selected.value) return 0;
  return entries.value.reduce((total, entry) => {
    if (selected.value?.kind === "customer")
      return total + (entry.type === 1 ? entry.amount : -entry.amount);
    return total + (entry.isDebit ? -entry.amount : entry.amount);
  }, 0);
});
async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  try {
    const [customerResult, supplierResult] = await Promise.all([
      api.get<PagedResult<Customer>>("/customers", {
        params: {
          tenantId: auth.tenantId,
          isActive: true,
          pageNumber: 1,
          pageSize: 50,
        },
      }),
      api.get<Supplier[]>("/suppliers", {
        params: { tenantId: auth.tenantId },
      }),
    ]);
    customers.value = customerResult.data.items;
    suppliers.value = supplierResult.data.filter((item) => item.isActive);
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}
async function select(kind: "customer" | "supplier", id: string, name: string) {
  selected.value = { kind, id, name };
  entries.value = [];
  detailLoading.value = true;
  error.value = "";
  try {
    const path =
      kind === "customer"
        ? `/sales/customers/${id}/account`
        : `/suppliers/${id}/account`;
    const { data } = await api.get<AccountEntry[]>(path, {
      params: { tenantId: auth.tenantId },
    });
    entries.value = data;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    detailLoading.value = false;
  }
}
async function recordMovement() {
  const descriptionError = requiredText(
    movement.value.description,
    "La descripción",
    300,
  );
  const amountError = nonNegative(movement.value.amount, "El importe");
  if (!movement.value.sessionId || descriptionError || amountError) {
    error.value = !movement.value.sessionId
      ? "El ID de la sesión de caja es obligatorio."
      : descriptionError || amountError;
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await api.post(
      `/cash-registers/sessions/${movement.value.sessionId}/movements`,
      {
        tenantId: auth.tenantId,
        cashRegisterSessionId: movement.value.sessionId,
        paymentMethod: movement.value.paymentMethod,
        amount: movement.value.amount,
        isIncome: movement.value.isIncome,
        description: movement.value.description,
      },
    );
    showMovement.value = false;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
watch(() => auth.tenantId, load, { immediate: true });
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Finanzas</div>
      <h1>Cuentas corrientes y caja</h1>
      <p>
        Consultá saldos de clientes y proveedores, y registrá movimientos de
        caja.
      </p>
    </div>
    <button class="primary" @click="showMovement = true">
      <WalletCards :size="17" />Registrar movimiento
    </button>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div class="account-summary">
    <article>
      <span class="finance-icon green"><ArrowDownRight /></span>
      <div>
        <p>Crédito habilitado de clientes</p>
        <strong>{{ money(totalReceivable) }}</strong>
      </div>
    </article>
    <article>
      <span class="finance-icon orange"><ArrowUpRight /></span>
      <div>
        <p>Proveedores activos</p>
        <strong>{{ totalPayable }}</strong>
      </div>
    </article>
  </div>
  <div class="accounts-grid">
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Clientes</h2>
          <p>Seleccioná un cliente para consultar su cuenta.</p>
        </div>
        <Search :size="19" class="muted" />
      </div>
      <div v-if="loading" class="empty-small">
        <LoaderCircle class="spin" /> Cargando clientes…
      </div>
      <div v-else class="entity-list">
        <button
          v-for="customer in customers"
          :key="customer.id"
          :class="{ selected: selected?.id === customer.id }"
          @click="select('customer', customer.id, customer.name)"
        >
          <span
            ><strong>{{ customer.name }}</strong
            ><small
              >{{ customer.documentNumber }} ·
              {{ customer.email || "Sin email" }}</small
            ></span
          ><strong>{{ money(customerBalance(customer)) }}</strong>
        </button>
        <p v-if="!customers.length" class="empty-small">
          No hay clientes activos.
        </p>
      </div>
    </section>
    <section class="panel">
      <div class="section-heading">
        <div>
          <h2>Proveedores</h2>
          <p>Seleccioná un proveedor para consultar su cuenta.</p>
        </div>
        <Landmark :size="19" class="muted" />
      </div>
      <div v-if="loading" class="empty-small">
        <LoaderCircle class="spin" /> Cargando proveedores…
      </div>
      <div v-else class="entity-list">
        <button
          v-for="supplier in suppliers"
          :key="supplier.id"
          :class="{ selected: selected?.id === supplier.id }"
          @click="select('supplier', supplier.id, supplier.legalName)"
        >
          <span
            ><strong>{{ supplier.legalName }}</strong
            ><small
              >{{ supplier.taxId }} · {{ supplier.email || "Sin email" }}</small
            ></span
          ><strong>Ver cuenta</strong>
        </button>
        <p v-if="!suppliers.length" class="empty-small">
          No hay proveedores activos.
        </p>
      </div>
    </section>
  </div>
  <section class="panel account-detail">
    <div class="section-heading">
      <div>
        <h2>
          {{ selected ? `Cuenta de ${selected.name}` : "Detalle de cuenta" }}
        </h2>
        <p>
          {{
            selected
              ? "Movimientos registrados por el backend."
              : "Elegí un cliente o proveedor."
          }}
        </p>
      </div>
      <strong v-if="selected" class="account-balance"
        >Saldo: {{ money(selectedBalance) }}</strong
      >
    </div>
    <div v-if="detailLoading" class="empty-small">
      <LoaderCircle class="spin" /> Cargando movimientos…
    </div>
    <div v-else-if="selected && entries.length" class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Concepto</th>
            <th>Tipo</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td data-label="Fecha">
              {{ new Date(entry.occurredAtUtc).toLocaleDateString("es-AR") }}
            </td>
            <td data-label="Concepto">{{ entry.description }}</td>
            <td data-label="Tipo">
              <span
                class="status"
                :class="
                  entry.isDebit || entry.type === 1
                    ? 'danger'
                    : 'success-status'
                "
                >{{
                  entry.isDebit || entry.type === 1 ? "Debe" : "Haber"
                }}</span
              >
            </td>
            <td data-label="Importe">{{ money(entry.amount) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="empty-small">
      {{
        selected
          ? "Todavía no hay movimientos registrados."
          : "Seleccioná una cuenta para ver sus movimientos."
      }}
    </p>
  </section>
  <div
    v-if="showMovement"
    class="modal-backdrop"
    @click.self="showMovement = false"
  >
    <section
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movement-title"
    >
      <button
        class="icon-button modal-close"
        aria-label="Cerrar"
        @click="showMovement = false"
      >
        <X />
      </button>
      <h2 id="movement-title">Registrar movimiento de caja</h2>
      <p>
        El backend requiere el ID de una sesión abierta. Aún no ofrece una lista
        de sesiones para seleccionarla.
      </p>
      <form @submit.prevent="recordMovement">
        <label
          >ID de sesión de caja<input
            v-model.trim="movement.sessionId"
            required
            placeholder="UUID de la sesión abierta" /></label
        ><label
          >Descripción<input
            v-model.trim="movement.description"
            required
            maxlength="300"
            placeholder="Ej. Cobro factura A-0001"
        /></label>
        <div class="form-grid">
          <label
            >Importe<input
              v-model.number="movement.amount"
              type="number"
              min="0"
              step="0.01"
              required /></label
          ><label
            >Medio de pago<select v-model.number="movement.paymentMethod">
              <option :value="1">Efectivo</option>
              <option :value="5">Mercado Pago</option>
              <option :value="4">Transferencia</option>
            </select></label
          >
        </div>
        <div class="payment-options">
          <label
            ><input
              v-model="movement.isIncome"
              :value="true"
              type="radio"
            />Ingreso</label
          ><label
            ><input
              v-model="movement.isIncome"
              :value="false"
              type="radio"
            />Egreso</label
          >
        </div>
        <button class="primary full" :disabled="saving">
          <LoaderCircle v-if="saving" class="spin" :size="16" />{{
            saving ? "Registrando…" : "Guardar movimiento"
          }}
        </button>
      </form>
    </section>
  </div>
</template>
