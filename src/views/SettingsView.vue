<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Building2, CircleHelp, ImageUp, KeyRound, MapPin, Plus, Trash2, TriangleAlert, X } from "lucide-vue-next";
import { api, apiError, notify } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import { getPrintFormat, savePrintBusiness, savePrintFormat, type PrintFormat } from "../services/receiptPrint";

type TenantUser = { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; warehouseIds: string[] };
const auth = useAuthStore(), tenant = useTenantStore();
const tab = ref("business"), loading = ref(false), saving = ref(false), error = ref("");
const usersError = ref("");
const users = ref<TenantUser[]>([]), showUser = ref(false), assigning = ref<TenantUser | null>(null), assignmentIds = ref<string[]>([]);
const business = reactive({ name: "", legalName: "", taxId: "", taxCondition: "Responsable Inscripto", address: "", phone: "", logoUrl: "" });
const printFormat = ref<PrintFormat>("a4");
const afip = reactive({ issuerTaxId: "", certificateContent: "", privateKeyContent: "", certificatePassphrase: "", certificateAlias: "", isPfxCertificate: false, environment: 1, salesPoint: 1, defaultConcept: 1 });
const user = reactive({ firstName: "", lastName: "", email: "", password: "", role: "Seller", warehouseIds: [] as string[] });
const requiresWarehouses = computed(() => ["Seller", "Warehouse"].includes(user.role));
const warehouseName = (id: string) => tenant.warehouses.find((warehouse) => warehouse.id === id)?.name || "Sucursal eliminada";

function toggle(list: string[], id: string) { const index = list.indexOf(id); if (index >= 0) list.splice(index, 1); else list.push(id); }
function selectTab(next: string) { tab.value = next; error.value = ""; }
function resetUser() { Object.assign(user, { firstName: "", lastName: "", email: "", password: "", role: "Seller", warehouseIds: tenant.warehouses[0] ? [tenant.warehouses[0].id] : [] }); }
async function load() {
  if (!auth.tenantId) return;
  loading.value = true; error.value = "";
  try {
    const [businessResponse, usersResponse] = await Promise.allSettled([
      api.get("/settings/business", { params: { tenantId: auth.tenantId } }),
      api.get<TenantUser[]>("/users", { params: { tenantId: auth.tenantId } }),
    ]);
    if (businessResponse.status === "fulfilled") {
      Object.assign(business, businessResponse.value.data);
      savePrintBusiness(auth.tenantId, businessResponse.value.data);
      printFormat.value = businessResponse.value.data.printFormat || "a4";
    }
    else error.value = apiError(businessResponse.reason);
    usersError.value = usersResponse.status === "rejected" ? apiError(usersResponse.reason) : "";
    if (usersResponse.status === "fulfilled") users.value = usersResponse.value.data;
  } finally { loading.value = false; }
}
async function saveBusiness() { saving.value = true; error.value = ""; try { const { data } = await api.put("/settings/business", { tenantId: auth.tenantId, ...business, printFormat: printFormat.value }); Object.assign(business, data); savePrintBusiness(auth.tenantId, data); savePrintFormat(auth.tenantId, printFormat.value); tenant.businessName = data.name; tenant.businessTaxId = data.taxId; tenant.businessLegalName = data.legalName || ""; tenant.businessTaxCondition = data.taxCondition || ""; tenant.businessAddress = data.address || ""; tenant.businessPhone = data.phone || ""; tenant.businessLogoUrl = data.logoUrl || ""; tenant.printFormat = data.printFormat; notify("Datos comerciales actualizados."); } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; } }
function selectLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 512 * 1024) {
    error.value = "Elegí un logo PNG, JPG o WEBP de hasta 512 KB.";
    (event.target as HTMLInputElement).value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { business.logoUrl = String(reader.result || ""); error.value = ""; };
  reader.readAsDataURL(file);
}
function removeLogo() { business.logoUrl = ""; }
async function saveAfip() { saving.value = true; error.value = ""; try { await api.post("/settings/afip-cert", { tenantId: auth.tenantId, ...afip }); notify("Certificado fiscal guardado."); } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; } }
async function saveUser() {
  if (requiresWarehouses.value && !user.warehouseIds.length) { error.value = "Asigná al menos una sucursal al usuario."; return; }
  saving.value = true; error.value = "";
  try { await api.post("/users", { tenantId: auth.tenantId, ...user, warehouseIds: requiresWarehouses.value ? user.warehouseIds : [] }); showUser.value = false; notify("Usuario creado con sus permisos."); await load(); } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
async function saveAssignments() {
  if (!assigning.value || !assignmentIds.value.length) { error.value = "Asigná al menos una sucursal al operador."; return; }
  saving.value = true; error.value = "";
  try { await api.put(`/users/${assigning.value.id}/warehouses`, { tenantId: auth.tenantId, warehouseIds: assignmentIds.value }); assigning.value = null; notify("Sucursales asignadas correctamente."); await load(); } catch (cause) { error.value = apiError(cause); } finally { saving.value = false; }
}
function openAssignments(target: TenantUser) { assigning.value = target; assignmentIds.value = [...target.warehouseIds]; error.value = ""; }
async function toggleStatus(target: TenantUser) { try { await api.put(`/users/${target.id}/toggle-status`, { tenantId: auth.tenantId, isActive: !target.isActive }); await load(); } catch (cause) { error.value = apiError(cause); } }
watch(() => auth.tenantId, () => { printFormat.value = getPrintFormat(auth.tenantId); void load(); }, { immediate: true });
watch(printFormat, value => { if (auth.tenantId) savePrintFormat(auth.tenantId, value); });
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Configuración</div><h1>Configuración</h1><p>Datos comerciales, facturación y accesos del equipo.</p></div></div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div class="tabs"><button type="button" :class="{ active: tab === 'business' }" @click="selectTab('business')">Empresa</button><button type="button" :class="{ active: tab === 'afip' }" @click="selectTab('afip')">ARCA</button><button type="button" :class="{ active: tab === 'users' }" @click="selectTab('users')">Usuarios</button></div>
  <section v-if="tab === 'business'" class="panel">
    <h2>Datos de la empresa</h2>
    <form class="form-grid" novalidate @submit.prevent="saveBusiness">
      <label>Nombre comercial<input v-model.trim="business.name" required maxlength="150" /></label>
      <label>Razón social<input v-model.trim="business.legalName" maxlength="150" /></label>
      <label>CUIT<input v-model="business.taxId" inputmode="numeric" pattern="[0-9]{11}" required /></label>
      <label>Condición IVA<select v-model="business.taxCondition"><option>Responsable Inscripto</option><option>Monotributo</option><option>Exento</option></select></label>
      <label class="wide">Dirección<input v-model.trim="business.address" maxlength="300" /></label>
      <label>Teléfono<input v-model.trim="business.phone" maxlength="30" /></label>
      <label>URL del logo <small>Opcional</small><input v-model.trim="business.logoUrl" type="url" placeholder="https://…" /></label>
      <div class="logo-control wide">
        <div><strong>Logo para comprobantes</strong><small class="muted">Subí PNG, JPG o WEBP (máx. 512 KB). Se verá en tickets y facturas.</small></div>
        <div class="logo-actions"><img v-if="business.logoUrl" :src="business.logoUrl" alt="Vista previa del logo" /><label class="secondary upload-logo"><ImageUp :size="16" />{{ business.logoUrl ? 'Cambiar logo' : 'Cargar logo' }}<input type="file" accept="image/png,image/jpeg,image/webp" @change="selectLogo" /></label><button v-if="business.logoUrl" type="button" class="icon-button danger-button" title="Quitar logo" @click="removeLogo"><Trash2 :size="16" /></button></div>
      </div>
      <label class="wide">Formato de impresión<select v-model="printFormat"><option value="a4">Hoja A4 / PDF</option><option value="thermal-80">Ticket térmico 80 mm</option><option value="thermal-58">Ticket térmico 58 mm</option></select><small class="muted">Se aplicará al imprimir comprobantes desde el POS, historial y facturación.</small></label>
      <button class="primary full" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
    </form>
  </section>
  <section v-if="tab === 'afip'" class="panel">
    <h2>Facturación ARCA</h2>
    <p class="muted">La condición IVA del emisor define automáticamente la letra del comprobante. Probá primero en homologación.</p>
    <details class="afip-guide">
      <summary><CircleHelp :size="18" />¿Necesitás ayuda para configurar tu certificado?</summary>
      <div class="afip-guide-content">
        <p>Completá estos pasos antes de cargar el certificado en SalesSaaS.</p>
        <ol>
          <li><strong>Generá la clave privada y la solicitud.</strong> Creá los archivos <code>.key</code> y <code>.csr</code> para el Alias que vas a usar.</li>
          <li><strong>Da de alta el punto de venta en AFIP.</strong> Debe ser de tipo <em>Web Services</em>.</li>
          <li><strong>Generá el certificado en ARCA/AFIP.</strong> En <em>Administración de Certificados Digitales</em>, subí el archivo <code>.csr</code> y descargá el <code>.crt</code> generado.</li>
          <li><strong>Asociá el servicio.</strong> En <em>Administración de Relaciones de Clave Fiscal</em>, vinculá el Alias al servicio <em>Facturación Electrónica (WSFE)</em>.</li>
          <li><strong>Cargá los datos aquí.</strong> Copiá el contenido completo de los archivos <code>.crt</code> y <code>.key</code> en los campos de este formulario.</li>
        </ol>
      </div>
    </details>
    <p v-if="afip.environment === 1" class="afip-test-mode" role="status"><TriangleAlert :size="16" /><span><strong>Modo de Pruebas activo:</strong> Las facturas emitidas no tienen validez fiscal.</span></p>
    <form class="form-grid" novalidate @submit.prevent="saveAfip">
      <label>CUIT emisor<input v-model="afip.issuerTaxId" inputmode="numeric" pattern="[0-9]{11}" required /></label>
      <label>Punto de venta<input v-model.number="afip.salesPoint" type="number" min="1" required /><small class="field-help"><CircleHelp :size="14" />Número de punto de venta dado de alta en AFIP configurado para Web Services (ej. 1, 2, 3).</small></label>
      <label>Alias certificado<input v-model.trim="afip.certificateAlias" required maxlength="100" /></label>
      <label>Entorno<select v-model.number="afip.environment"><option :value="1">Homologación</option><option :value="2">Producción</option></select><small class="field-help"><CircleHelp :size="14" />Usá Homologación para hacer pruebas sin validez fiscal y Producción para facturar legalmente.</small></label>
      <label class="wide">Certificado .crt<textarea v-model="afip.certificateContent" required /></label>
      <label class="wide">Clave privada .key<textarea v-model="afip.privateKeyContent" required /></label>
      <button class="primary full" :disabled="saving"><KeyRound :size="16" />{{ saving ? 'Guardando…' : 'Guardar certificado' }}</button>
    </form>
  </section>
  <section v-if="tab === 'users'" class="panel"><div class="section-heading"><div><h2>Usuarios y sucursales</h2><p class="muted">Los cajeros y operadores sólo pueden trabajar en las sucursales asignadas.</p></div><button class="primary" @click="resetUser(); showUser = true"><Plus :size="16" />Nuevo usuario</button></div><p v-if="usersError" class="error" role="alert">{{ usersError }}</p><div v-if="loading" class="empty-small">Cargando usuarios…</div><div v-else class="responsive-table"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Sucursales autorizadas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody><tr v-for="member in users" :key="member.id"><td><strong>{{ member.firstName }} {{ member.lastName }}</strong><small>{{ member.email }}</small></td><td><span class="badge">{{ member.role }}</span></td><td><span v-if="['Owner','Admin'].includes(member.role)" class="muted">Todas las sucursales</span><span v-else>{{ member.warehouseIds.map(warehouseName).join(', ') || 'Sin asignar' }}</span></td><td><span :class="member.isActive ? 'status success-status' : 'status danger'">{{ member.isActive ? 'Activo' : 'Inactivo' }}</span></td><td><div class="invoice-actions"><button v-if="!['Owner','Admin'].includes(member.role)" title="Asignar sucursales" @click="openAssignments(member)"><MapPin :size="16" /></button><button class="secondary" @click="toggleStatus(member)">{{ member.isActive ? 'Desactivar' : 'Activar' }}</button></div></td></tr></tbody></table></div></section>
  <div v-if="showUser" class="modal-backdrop"><section class="modal"><button class="icon-button modal-close" @click="showUser = false"><X /></button><h2>Nuevo usuario</h2><p v-if="error" class="error">{{ error }}</p><form novalidate @submit.prevent="saveUser"><div class="form-grid"><label>Nombre<input v-model.trim="user.firstName" required /></label><label>Apellido<input v-model.trim="user.lastName" required /></label></div><label>Correo<input v-model.trim="user.email" type="email" required /></label><label>Contraseña<input v-model="user.password" type="password" minlength="12" required /></label><label>Rol<select v-model="user.role"><option value="Admin">Admin</option><option value="Seller">Cajero</option><option value="Warehouse">Stock Manager</option></select></label><fieldset v-if="requiresWarehouses" class="warehouse-list"><legend>Sucursales autorizadas</legend><label v-for="warehouse in tenant.warehouses" :key="warehouse.id" class="check-row"><input type="checkbox" :checked="user.warehouseIds.includes(warehouse.id)" @change="toggle(user.warehouseIds, warehouse.id)" /><span>{{ warehouse.name }}</span></label></fieldset><button class="primary full" :disabled="saving">{{ saving ? 'Creando…' : 'Crear usuario' }}</button></form></section></div>
  <div v-if="assigning" class="modal-backdrop"><section class="modal"><button class="icon-button modal-close" @click="assigning = null"><X /></button><div class="modal-icon"><Building2 /></div><h2>Sucursales de {{ assigning.firstName }}</h2><p>Este usuario sólo podrá seleccionar estas sucursales y operar dentro de ellas.</p><fieldset class="warehouse-list"><legend>Accesos habilitados</legend><label v-for="warehouse in tenant.warehouses" :key="warehouse.id" class="check-row"><input type="checkbox" :checked="assignmentIds.includes(warehouse.id)" @change="toggle(assignmentIds, warehouse.id)" /><span>{{ warehouse.name }}</span></label></fieldset><button class="primary full" :disabled="saving" @click="saveAssignments">{{ saving ? 'Guardando…' : 'Guardar accesos' }}</button></section></div>
</template>

<style scoped>
.tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem}.tabs button{padding:.6rem 1rem;border:1px solid #e2e8f0;border-radius:.6rem;background:#fff}.tabs button.active{color:#fff;background:#ec4899;border-color:#ec4899}.wide{grid-column:span 2}.warehouse-list{display:grid;gap:.5rem;border:1px solid #e2e8f0;border-radius:.75rem;padding:.8rem}.check-row{display:flex;align-items:center;gap:.55rem;cursor:pointer}.check-row input{width:auto}.success-text{display:block;margin-top:.3rem;color:#047857}.logo-control{display:flex;justify-content:space-between;align-items:center;gap:1rem;border:1px dashed #cbd5e1;border-radius:.75rem;padding:.85rem}.logo-control strong,.logo-control small{display:block}.logo-actions{display:flex;align-items:center;gap:.5rem}.logo-actions img{width:3.5rem;height:3.5rem;object-fit:contain;border:1px solid #e2e8f0;border-radius:.5rem;background:#fff}.upload-logo{position:relative;display:inline-flex;align-items:center;gap:.4rem;cursor:pointer}.upload-logo input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.danger-button{color:#e11d48}.afip-guide{margin:1.1rem 0;padding:.9rem 1rem;border:1px solid #f9a8d4;border-radius:.8rem;background:#fdf2f8}.afip-guide summary{display:flex;align-items:center;gap:.5rem;color:#be185d;font-weight:700;cursor:pointer;list-style:none}.afip-guide summary::-webkit-details-marker{display:none}.afip-guide-content{max-width:52rem;margin-top:.85rem;color:#475569}.afip-guide-content p{margin:0}.afip-guide-content ol{display:grid;gap:.6rem;margin:.8rem 0 0;padding-left:1.3rem}.afip-guide-content li{padding-left:.15rem;line-height:1.5}.afip-guide-content code{padding:.08rem .28rem;border-radius:.25rem;background:#fce7f3;color:#9d174d}.field-help{display:flex;align-items:flex-start;gap:.35rem;color:#64748b;font-size:.75rem;font-weight:400;line-height:1.4}.field-help svg{flex:0 0 auto;margin-top:.04rem;color:#db2777}.dark .afip-guide{border-color:#7c2d5b;background:#2e1930}.dark .afip-guide summary{color:#f9a8d4}.dark .afip-guide-content{color:#d1dced}.dark .afip-guide-content code{background:#442039;color:#fbcfe8}.dark .field-help{color:#b8c7dc}.dark .field-help svg{color:#f9a8d4}@media(max-width:600px){.wide{grid-column:span 1}.logo-control{align-items:flex-start;flex-direction:column}}
.afip-guide{display:inline-block;margin:1rem 0 .65rem;border:1px solid #e2e8f0;border-radius:.7rem;background:#fff}.afip-guide summary{display:flex;align-items:center;gap:.45rem;padding:.65rem .8rem;color:#475569;font-size:.84rem;font-weight:700;cursor:pointer;list-style:none}.afip-guide[open]{display:block;background:#fdfcff;border-color:#f9a8d4}.afip-guide[open] summary{color:#be185d;border-bottom:1px solid #fce7f3}.afip-guide-content{max-width:52rem;padding:.75rem .9rem;color:#475569;font-size:.82rem}.afip-guide-content ol{gap:.38rem;margin:.65rem 0 0;padding-left:1.2rem}.afip-guide-content li{line-height:1.45}.afip-test-mode{display:flex;align-items:flex-start;gap:.45rem;margin:.15rem 0 1rem;padding:.62rem .75rem;border:1px solid #fde68a;border-radius:.65rem;background:#fffbeb;color:#92400e;font-size:.8rem;line-height:1.4}.afip-test-mode svg{flex:0 0 auto;margin-top:.03rem}.dark .afip-guide{border-color:#475a77;background:#18233a}.dark .afip-guide[open]{border-color:#7c2d5b;background:#211b32}.dark .afip-guide summary{color:#cbd5e1}.dark .afip-guide[open] summary{color:#f9a8d4;border-color:#55304e}.dark .afip-guide-content{color:#d1dced}.dark .afip-test-mode{border-color:#785a13;background:#2d2715;color:#fde68a}
</style>
