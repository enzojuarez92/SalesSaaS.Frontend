<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Building2, KeyRound, MapPin, Plus, X } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";

type TenantUser = { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; warehouseIds: string[] };
const auth = useAuthStore(), tenant = useTenantStore();
const tab = ref("business"), loading = ref(false), saving = ref(false), error = ref(""), success = ref("");
const usersError = ref("");
const users = ref<TenantUser[]>([]), showUser = ref(false), assigning = ref<TenantUser | null>(null), assignmentIds = ref<string[]>([]);
const business = reactive({ name: "", legalName: "", taxId: "", taxCondition: "Responsable Inscripto", address: "", phone: "", logoUrl: "" });
const afip = reactive({ issuerTaxId: "", certificateContent: "", privateKeyContent: "", certificatePassphrase: "", certificateAlias: "", isPfxCertificate: false, environment: 1, salesPoint: 1, defaultConcept: 1 });
const user = reactive({ firstName: "", lastName: "", email: "", password: "", role: "Seller", warehouseIds: [] as string[] });
const requiresWarehouses = computed(() => ["Seller", "Warehouse"].includes(user.role));
const warehouseName = (id: string) => tenant.warehouses.find((warehouse) => warehouse.id === id)?.name || "Sucursal eliminada";

function toggle(list: string[], id: string) { const index = list.indexOf(id); if (index >= 0) list.splice(index, 1); else list.push(id); }
function selectTab(next: string) { tab.value = next; error.value = ""; success.value = ""; }
function resetUser() { Object.assign(user, { firstName: "", lastName: "", email: "", password: "", role: "Seller", warehouseIds: tenant.warehouses[0] ? [tenant.warehouses[0].id] : [] }); }
async function load() {
  if (!auth.tenantId) return;
  loading.value = true; error.value = "";
  try {
    const [businessResponse, usersResponse] = await Promise.allSettled([
      api.get("/settings/business", { params: { tenantId: auth.tenantId } }),
      api.get<TenantUser[]>("/users", { params: { tenantId: auth.tenantId } }),
    ]);
    if (businessResponse.status === "fulfilled") Object.assign(business, businessResponse.value.data);
    else error.value = apiError(businessResponse.reason);
    usersError.value = usersResponse.status === "rejected" ? apiError(usersResponse.reason) : "";
    if (usersResponse.status === "fulfilled") users.value = usersResponse.value.data;
  } finally { loading.value = false; }
}
async function saveBusiness() { saving.value = true; error.value = ""; try { await api.put("/settings/business", { tenantId: auth.tenantId, ...business }); success.value = "Datos comerciales actualizados."; } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; } }
async function saveAfip() { saving.value = true; error.value = ""; try { await api.post("/settings/afip-cert", { tenantId: auth.tenantId, ...afip }); success.value = "Certificado fiscal guardado."; } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; } }
async function saveUser() {
  if (requiresWarehouses.value && !user.warehouseIds.length) { error.value = "Asigná al menos una sucursal al usuario."; return; }
  saving.value = true; error.value = "";
  try { await api.post("/users", { tenantId: auth.tenantId, ...user, warehouseIds: requiresWarehouses.value ? user.warehouseIds : [] }); showUser.value = false; success.value = "Usuario creado con sus permisos."; await load(); } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
async function saveAssignments() {
  if (!assigning.value || !assignmentIds.value.length) { error.value = "Asigná al menos una sucursal al operador."; return; }
  saving.value = true; error.value = "";
  try { await api.put(`/users/${assigning.value.id}/warehouses`, { tenantId: auth.tenantId, warehouseIds: assignmentIds.value }); assigning.value = null; success.value = "Sucursales asignadas correctamente."; await load(); } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
function openAssignments(target: TenantUser) { assigning.value = target; assignmentIds.value = [...target.warehouseIds]; error.value = ""; }
async function toggleStatus(target: TenantUser) { try { await api.put(`/users/${target.id}/toggle-status`, { tenantId: auth.tenantId, isActive: !target.isActive }); await load(); } catch (cause) { error.value = apiError(cause); } }
watch(() => auth.tenantId, () => void load(), { immediate: true });
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Configuración</div><h1>Configuración</h1><p>Datos comerciales, facturación y accesos del equipo.</p></div></div>
  <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="success" class="success" role="status">{{ success }}</p>
  <div class="tabs"><button type="button" :class="{ active: tab === 'business' }" @click="selectTab('business')">Empresa</button><button type="button" :class="{ active: tab === 'afip' }" @click="selectTab('afip')">ARCA</button><button type="button" :class="{ active: tab === 'users' }" @click="selectTab('users')">Usuarios</button></div>
  <section v-if="tab === 'business'" class="panel"><h2>Datos de la empresa</h2><form class="form-grid" novalidate @submit.prevent="saveBusiness"><label>Nombre comercial<input v-model.trim="business.name" required maxlength="150" /></label><label>Razón social<input v-model.trim="business.legalName" maxlength="150" /></label><label>CUIT<input v-model="business.taxId" inputmode="numeric" pattern="[0-9]{11}" required /></label><label>Condición IVA<select v-model="business.taxCondition"><option>Responsable Inscripto</option><option>Monotributo</option><option>Exento</option></select></label><label class="wide">Dirección<input v-model.trim="business.address" maxlength="300" /></label><label>Teléfono<input v-model.trim="business.phone" maxlength="30" /></label><label>Logo URL<input v-model.trim="business.logoUrl" type="url" /></label><button class="primary full" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button></form></section>
  <section v-if="tab === 'afip'" class="panel"><h2>Facturación ARCA</h2><p class="muted">La condición IVA del emisor define automáticamente la letra del comprobante. Probá primero en homologación.</p><form class="form-grid" novalidate @submit.prevent="saveAfip"><label>CUIT emisor<input v-model="afip.issuerTaxId" inputmode="numeric" pattern="[0-9]{11}" required /></label><label>Punto de venta<input v-model.number="afip.salesPoint" type="number" min="1" required /></label><label>Alias certificado<input v-model.trim="afip.certificateAlias" required maxlength="100" /></label><label>Entorno<select v-model.number="afip.environment"><option :value="1">Homologación</option><option :value="2">Producción</option></select></label><label class="wide">Certificado .crt<textarea v-model="afip.certificateContent" required /></label><label class="wide">Clave privada .key<textarea v-model="afip.privateKeyContent" required /></label><button class="primary full" :disabled="saving"><KeyRound :size="16" />{{ saving ? 'Guardando…' : 'Guardar certificado' }}</button></form></section>
  <section v-if="tab === 'users'" class="panel"><div class="section-heading"><div><h2>Usuarios y sucursales</h2><p class="muted">Los cajeros y operadores sólo pueden trabajar en las sucursales asignadas.</p></div><button class="primary" @click="resetUser(); showUser = true"><Plus :size="16" />Nuevo usuario</button></div><p v-if="usersError" class="error" role="alert">{{ usersError }}</p><div v-if="loading" class="empty-small">Cargando usuarios…</div><div v-else class="responsive-table"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Sucursales autorizadas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody><tr v-for="member in users" :key="member.id"><td><strong>{{ member.firstName }} {{ member.lastName }}</strong><small>{{ member.email }}</small></td><td><span class="badge">{{ member.role }}</span></td><td><span v-if="['Owner','Admin'].includes(member.role)" class="muted">Todas las sucursales</span><span v-else>{{ member.warehouseIds.map(warehouseName).join(', ') || 'Sin asignar' }}</span></td><td><span :class="member.isActive ? 'status success-status' : 'status danger'">{{ member.isActive ? 'Activo' : 'Inactivo' }}</span></td><td><div class="invoice-actions"><button v-if="!['Owner','Admin'].includes(member.role)" title="Asignar sucursales" @click="openAssignments(member)"><MapPin :size="16" /></button><button class="secondary" @click="toggleStatus(member)">{{ member.isActive ? 'Desactivar' : 'Activar' }}</button></div></td></tr></tbody></table></div></section>
  <div v-if="showUser" class="modal-backdrop" @click.self="showUser = false"><section class="modal"><button class="icon-button modal-close" @click="showUser = false"><X /></button><h2>Nuevo usuario</h2><p v-if="error" class="error">{{ error }}</p><form novalidate @submit.prevent="saveUser"><div class="form-grid"><label>Nombre<input v-model.trim="user.firstName" required /></label><label>Apellido<input v-model.trim="user.lastName" required /></label></div><label>Correo<input v-model.trim="user.email" type="email" required /></label><label>Contraseña<input v-model="user.password" type="password" minlength="12" required /></label><label>Rol<select v-model="user.role"><option value="Admin">Admin</option><option value="Seller">Cajero</option><option value="Warehouse">Stock Manager</option></select></label><fieldset v-if="requiresWarehouses" class="warehouse-list"><legend>Sucursales autorizadas</legend><label v-for="warehouse in tenant.warehouses" :key="warehouse.id" class="check-row"><input type="checkbox" :checked="user.warehouseIds.includes(warehouse.id)" @change="toggle(user.warehouseIds, warehouse.id)" /><span>{{ warehouse.name }}</span></label></fieldset><button class="primary full" :disabled="saving">{{ saving ? 'Creando…' : 'Crear usuario' }}</button></form></section></div>
  <div v-if="assigning" class="modal-backdrop" @click.self="assigning = null"><section class="modal"><button class="icon-button modal-close" @click="assigning = null"><X /></button><div class="modal-icon"><Building2 /></div><h2>Sucursales de {{ assigning.firstName }}</h2><p>Este usuario sólo podrá seleccionar estas sucursales y operar dentro de ellas.</p><fieldset class="warehouse-list"><legend>Accesos habilitados</legend><label v-for="warehouse in tenant.warehouses" :key="warehouse.id" class="check-row"><input type="checkbox" :checked="assignmentIds.includes(warehouse.id)" @change="toggle(assignmentIds, warehouse.id)" /><span>{{ warehouse.name }}</span></label></fieldset><button class="primary full" :disabled="saving" @click="saveAssignments">{{ saving ? 'Guardando…' : 'Guardar accesos' }}</button></section></div>
</template>

<style scoped>
.tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}.tabs button{padding:.6rem 1rem;border:1px solid #e2e8f0;border-radius:.6rem;background:#fff}.tabs button.active{color:#fff;background:#ec4899;border-color:#ec4899}.wide{grid-column:span 2}.warehouse-list{display:grid;gap:.5rem;border:1px solid #e2e8f0;border-radius:.75rem;padding:.8rem}.check-row{display:flex;align-items:center;gap:.55rem;cursor:pointer}.check-row input{width:auto}.success-text{display:block;margin-top:.3rem;color:#047857}@media(max-width:600px){.wide{grid-column:span 1}}
</style>
