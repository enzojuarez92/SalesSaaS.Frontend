<script setup lang="ts">
import { money } from "../services/format";
import CurrencyInput from "../components/CurrencyInput.vue";
import { computed, onMounted, ref, watch } from "vue";
import { ArrowDownCircle, ArrowUpCircle, Banknote, CircleAlert, DoorOpen, LoaderCircle, LockKeyhole, Plus, ReceiptText, WalletCards, X } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { CashSession } from "../types/api";

const auth = useAuthStore();
const tenant = useTenantStore();
const current = ref<CashSession | null>(null), history = ref<CashSession[]>([]);
const loading = ref(false), saving = ref(false), error = ref(""), success = ref("");
const showOpen = ref(false), showMovement = ref(false), showClose = ref(false);
const openingBalance = ref(0), closingBalance = ref(0), movementAmount = ref(0), movementDescription = ref(""), movementIncome = ref(true), movementPayment = ref(1);

const methodName = (method: number) => ({ 1: "Efectivo", 2: "Tarjeta crédito", 3: "Tarjeta débito", 4: "Transferencia", 5: "Mercado Pago", 6: "Cta. corriente" }[method] || "Otro");
const physicalDifference = computed(() => closingBalance.value - (current.value?.expectedCash || 0));
const currentCashTotal = computed(() => current.value?.totals.find(total => total.paymentMethod === 1)?.net || 0);

async function load() {
  if (!auth.tenantId) return;
  loading.value = true; error.value = "";
  try {
    if (!tenant.warehouses.length) await tenant.load();
    const params = { tenantId: auth.tenantId, warehouseId: tenant.activeWarehouseId || undefined };
    const [session, sessions] = await Promise.all([api.get<CashSession | "">("/cash/current", { params }), api.get<CashSession[]>("/cash/history", { params: { tenantId: auth.tenantId, take: 12 } })]);
    current.value = session.data && typeof session.data === "object" ? session.data : null;
    history.value = sessions.data;
  } catch (cause) { error.value = apiError(cause); } finally { loading.value = false; }
}
function openCash() { openingBalance.value = 0; error.value = ""; showOpen.value = true; }
async function submitOpen() {
  if (!tenant.activeWarehouseId) { error.value = "Elegí un depósito antes de abrir la caja."; return; }
  if (openingBalance.value < 0) { error.value = "El fondo inicial no puede ser negativo."; return; }
  saving.value = true; error.value = "";
  try { await api.post("/cash/open", { tenantId: auth.tenantId, warehouseId: tenant.activeWarehouseId, openingBalance: openingBalance.value }); showOpen.value = false; success.value = "Caja abierta correctamente."; await load(); }
  catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
function openMovement(income: boolean) { movementIncome.value = income; movementAmount.value = 0; movementDescription.value = ""; movementPayment.value = 1; error.value = ""; showMovement.value = true; }
async function submitMovement() {
  if (!current.value) return;
  if (!movementAmount.value || movementAmount.value <= 0 || !movementDescription.value.trim()) { error.value = "Ingresá un importe mayor a cero y el motivo del movimiento."; return; }
  saving.value = true; error.value = "";
  try { await api.post("/cash/movements", { tenantId: auth.tenantId, cashRegisterSessionId: current.value.id, paymentMethod: movementPayment.value, amount: movementAmount.value, isIncome: movementIncome.value, description: movementDescription.value.trim() }); showMovement.value = false; success.value = movementIncome.value ? "Ingreso registrado en caja." : "Egreso registrado en caja."; await load(); }
  catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
function openClose() { if (!current.value) return; closingBalance.value = current.value.expectedCash; error.value = ""; showClose.value = true; }
async function submitClose() {
  if (!current.value || closingBalance.value < 0) { error.value = "El monto contado no puede ser negativo."; return; }
  saving.value = true; error.value = "";
  try { const { data } = await api.post<{ difference: number }>("/cash/close", { tenantId: auth.tenantId, cashRegisterSessionId: current.value.id, closingBalance: closingBalance.value }); showClose.value = false; success.value = data.difference === 0 ? "Caja cerrada sin diferencias." : `Caja cerrada con una diferencia de ${money(data.difference)}.`; await load(); }
  catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
watch(() => [auth.tenantId, tenant.activeWarehouseId], load, { immediate: true });
onMounted(() => { if (!tenant.warehouses.length) void tenant.load(); });
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Caja</div><h1>Control de caja</h1><p>Abrí turnos, registrá movimientos y conciliá el efectivo al cierre.</p></div><button v-if="!current" class="primary" @click="openCash"><DoorOpen :size="17" />Abrir caja</button></div>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="success" class="success" role="status">{{ success }}</p>
  <section class="panel cash-selector"><label>Depósito / sucursal<select v-model="tenant.activeWarehouseId"><option value="">Elegí un depósito</option><option v-for="warehouse in tenant.warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option></select></label></section>
  <div v-if="loading" class="empty-small"><LoaderCircle class="spin" /> Cargando estado de caja…</div>
  <template v-else-if="current"><section class="cash-hero"><div><span class="badge">Caja abierta</span><h2>{{ current.warehouseName }}</h2><p>Abierta el {{ new Date(current.openedAtUtc).toLocaleString("es-AR") }}</p></div><strong>{{ money(current.expectedCash) }}</strong><span>efectivo esperado</span><div class="cash-actions"><button class="secondary" @click="openMovement(true)"><ArrowUpCircle :size="17" />Ingreso</button><button class="secondary" @click="openMovement(false)"><ArrowDownCircle :size="17" />Egreso</button><button class="primary" @click="openClose"><LockKeyhole :size="17" />Cerrar y arquear</button></div></section>
    <div class="cash-kpis"><article><span class="cash-icon"><Banknote /></span><p>Fondo inicial<strong>{{ money(current.openingBalance) }}</strong></p></article><article><span class="cash-icon"><WalletCards /></span><p>Movimientos efectivo<strong>{{ money(currentCashTotal) }}</strong></p></article><article><span class="cash-icon"><ReceiptText /></span><p>Saldo esperado<strong>{{ money(current.expectedCash) }}</strong></p></article></div>
    <section class="panel"><div class="section-heading"><div><h2>Resumen por medio de pago</h2><p>Ingresos y egresos de este turno.</p></div></div><div class="payment-summary"><article v-for="total in current.totals" :key="total.paymentMethod"><span>{{ methodName(total.paymentMethod) }}</span><strong>{{ money(total.net) }}</strong><small>Ingresos {{ money(total.income) }} · Egresos {{ money(total.expense) }}</small></article><p v-if="!current.totals.length" class="empty-small">Todavía no hay movimientos registrados.</p></div></section>
    <section class="panel"><div class="section-heading"><div><h2>Movimientos del turno</h2><p>Las ventas y cobros se agregan automáticamente.</p></div></div><div class="responsive-table"><table><thead><tr><th>Hora</th><th>Detalle</th><th>Medio</th><th>Movimiento</th></tr></thead><tbody><tr v-for="movement in current.movements" :key="movement.id"><td data-label="Hora">{{ new Date(movement.occurredAtUtc).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }}</td><td data-label="Detalle">{{ movement.description }}</td><td data-label="Medio">{{ methodName(movement.paymentMethod) }}</td><td data-label="Movimiento"><span :class="movement.isIncome ? 'status success-status' : 'status danger'">{{ movement.isIncome ? "+" : "−" }} {{ money(movement.amount) }}</span></td></tr></tbody></table></div></section>
  </template>
  <section v-else class="empty-state panel"><WalletCards :size="38" /><h2>No hay una caja abierta</h2><p>Elegí el depósito y abrí un turno para registrar ventas, cobros e ingresos manuales.</p><button class="primary" @click="openCash"><Plus :size="17" />Abrir caja</button></section>
  <section class="panel history"><div class="section-heading"><div><h2>Historial de turnos</h2><p>Últimas aperturas y cierres.</p></div></div><div class="responsive-table"><table><thead><tr><th>Depósito</th><th>Apertura</th><th>Cierre</th><th>Diferencia</th></tr></thead><tbody><tr v-for="session in history" :key="session.id"><td data-label="Depósito">{{ session.warehouseName }}</td><td data-label="Apertura">{{ money(session.openingBalance) }}</td><td data-label="Cierre">{{ session.closingBalance === null ? "Abierta" : money(session.closingBalance) }}</td><td data-label="Diferencia"><span v-if="session.difference !== null" :class="session.difference === 0 ? 'status success-status' : 'status danger'">{{ money(session.difference) }}</span><span v-else>—</span></td></tr><tr v-if="!history.length"><td colspan="4" class="empty-small">Sin turnos registrados.</td></tr></tbody></table></div></section>
  <div v-if="showOpen" class="modal-backdrop"><section class="modal"><button class="icon-button modal-close" @click="showOpen = false"><X /></button><div class="modal-icon"><DoorOpen /></div><h2>Abrir caja</h2><p>Ingresá el fondo inicial en efectivo para {{ tenant.warehouses.find(w => w.id === tenant.activeWarehouseId)?.name || "el depósito seleccionado" }}.</p><form novalidate @submit.prevent="submitOpen"><label>Fondo inicial<CurrencyInput v-model="openingBalance" :min="0" autofocus /></label><button class="primary full" :disabled="saving"><LoaderCircle v-if="saving" class="spin" :size="16" />Abrir turno</button></form></section></div>
  <div v-if="showMovement" class="modal-backdrop"><section class="modal"><button class="icon-button modal-close" @click="showMovement = false"><X /></button><div class="modal-icon"><component :is="movementIncome ? ArrowUpCircle : ArrowDownCircle" /></div><h2>{{ movementIncome ? "Registrar ingreso" : "Registrar egreso" }}</h2><form novalidate @submit.prevent="submitMovement"><label>Importe<CurrencyInput v-model="movementAmount" :min="0.01" autofocus /></label><label>Medio de pago<select v-model.number="movementPayment"><option :value="1">Efectivo</option><option :value="4">Transferencia</option><option :value="5">Mercado Pago</option></select></label><label>Motivo<input v-model.trim="movementDescription" maxlength="300" placeholder="Ej. Retiro para cambio" /></label><button class="primary full" :disabled="saving">Guardar movimiento</button></form></section></div>
  <div v-if="showClose && current" class="modal-backdrop"><section class="modal"><button class="icon-button modal-close" @click="showClose = false"><X /></button><div class="modal-icon"><LockKeyhole /></div><h2>Arqueo y cierre</h2><p>El sistema espera <strong>{{ money(current.expectedCash) }}</strong> en efectivo.</p><form novalidate @submit.prevent="submitClose"><label>Importe físico contado<CurrencyInput v-model="closingBalance" :min="0" autofocus /></label><p class="difference" :class="{ mismatch: physicalDifference !== 0 }"><CircleAlert :size="17" />{{ physicalDifference === 0 ? "Sin diferencia" : `${physicalDifference > 0 ? "Sobrante" : "Faltante"}: ${money(Math.abs(physicalDifference))}` }}</p><button class="primary full" :disabled="saving">Confirmar cierre</button></form></section></div>
</template>

<style scoped>
.cash-selector { padding: 1rem; margin-bottom: 1rem; max-width: 360px; } .cash-hero { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: .55rem 1.5rem; padding: 1.5rem; border-radius: 1rem; color: #fff; background: linear-gradient(120deg,#ec4899,#e11d48); box-shadow: 0 10px 25px rgba(236,72,153,.2); margin-bottom: 1rem; } .cash-hero h2 { margin: .55rem 0 .15rem; } .cash-hero p,.cash-hero > span:last-of-type { margin: 0; color: #fce7f3; } .cash-hero > strong { font-size: clamp(1.7rem,4vw,2.4rem); align-self: end; } .cash-actions { grid-column: 1/-1; display: flex; flex-wrap: wrap; gap: .65rem; margin-top: .5rem; } .cash-actions .secondary { background: #fff; border-color: #fff; color: #be185d; } .cash-kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-bottom: 1rem; } .cash-kpis article { display:flex; gap:.75rem; align-items:center; padding:1rem; border:1px solid #e2e8f0; border-radius:.9rem; background:#fff; box-shadow:0 1px 2px rgba(15,23,42,.04); } .cash-kpis p { margin:0; color:#64748b; } .cash-kpis strong { display:block; margin-top:.15rem; color:#0f172a; font-size:1.12rem; } .cash-icon { display:grid; place-items:center; width:2.4rem;height:2.4rem; border-radius:.7rem; color:#db2777; background:#fce7f3; } .payment-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.75rem; } .payment-summary article { display:grid; gap:.25rem; padding:1rem; border:1px solid #e2e8f0; border-radius:.75rem; } .payment-summary span,.payment-summary small { color:#64748b; } .payment-summary strong { color:#0f172a; font-size:1.1rem; } .history { margin-top:1rem; } .difference { display:flex; align-items:center; gap:.45rem; color:#059669; } .difference.mismatch { color:#e11d48; } @media(max-width:700px) { .cash-hero { grid-template-columns:1fr; } .cash-hero > strong { align-self:auto; } .cash-kpis { grid-template-columns:1fr; } .cash-actions > * { flex:1 1 130px; } }
</style>
