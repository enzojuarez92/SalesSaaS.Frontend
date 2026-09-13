<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Ban, Check, Eye, FilePlus2, LoaderCircle, PackageCheck, Paperclip, Pencil, Plus, Printer, ReceiptText, Save, ScrollText, Trash2, X } from "lucide-vue-next";
import { api, apiError, notify } from "../services/api";
import { dateTime, money } from "../services/format";
import { getPrintBusiness, printReceipt } from "../services/receiptPrint";
import CurrencyInput from "../components/CurrencyInput.vue";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { PagedResult, Product, Supplier } from "../types/api";

type PurchaseLine = { productId: string; quantity: number; unitCost: number };
type Purchase = { id: string; supplierId: string; status: string; totalAmount: number; createdAtUtc: string; createdByUserId?: string | null; invoiced: boolean };
type PurchaseItem = { productId: string; product: string; sku: string; quantity: number; unitCost: number; totalAmount: number };
type PurchaseDetail = Purchase & { items: PurchaseItem[] };
type PurchaseInvoice = { id: string; purchaseOrderId: string; supplierId: string; supplier: string; number: string; totalAmount: number; issuedAtUtc: string; hasAttachment: boolean };
type PurchaseInvoiceDetail = PurchaseInvoice & { items: PurchaseItem[] };

const auth = useAuthStore();
const tenant = useTenantStore();
const tab = ref<"orders" | "invoices" | "suppliers">("orders");
const busy = ref(false);
const orders = ref<Purchase[]>([]);
const invoices = ref<PurchaseInvoice[]>([]);
const suppliers = ref<Supplier[]>([]);
const products = ref<Product[]>([]);
const showOrderModal = ref(false);
const showSupplierModal = ref(false);
const showInvoiceModal = ref(false);
const selectedOrder = ref<PurchaseDetail | null>(null);
const selectedInvoice = ref<PurchaseInvoiceDetail | null>(null);
const supplierId = ref("");
const editingSupplier = ref<Supplier | null>(null);
const selectCreatedSupplier = ref(false);
const invoiceOrder = ref<Purchase | null>(null);
const invoiceNumber = ref("");
const lines = ref<PurchaseLine[]>([]);
const draftLine = reactive<PurchaseLine>({ productId: "", quantity: 1, unitCost: 0 });
const supplier = reactive({ legalName: "", taxId: "", taxCondition: "Responsable Inscripto", email: "", phone: "", address: "", isActive: true });
const statement = ref<Array<{ id: string; amount: number; isDebit: boolean; description: string; occurredAtUtc: string }>>([]);

const isAdmin = computed(() => ["Owner", "Admin"].includes(auth.user?.role || ""));
const total = computed(() => lines.value.reduce((sum, line) => sum + line.quantity * line.unitCost, 0));
const activeSuppliers = computed(() => suppliers.value.filter(item => item.isActive));
const selectableProducts = computed(() => supplierId.value ? products.value.filter(item => item.supplierId === supplierId.value) : products.value);
const supplierName = (id: string) => suppliers.value.find(item => item.id === id)?.legalName || "Proveedor eliminado";
const productSupplierName = (product: Product) => product.supplierId ? supplierName(product.supplierId) : "Sin proveedor";
const productName = (id: string) => products.value.find(item => item.id === id)?.name || "Producto eliminado";
const productSku = (id: string) => products.value.find(item => item.id === id)?.sku || "";
const statusLabel = (status: string) => ({ Draft: "Pendiente de recepción", PendingAuthorization: "Pendiente de autorización", PendingReceipt: "Pendiente de recepción", Received: "Recibida", Invoiced: "Facturada", Cancelled: "Anulada" })[status] || status;
const statusClass = (status: string) => ["Received", "Invoiced"].includes(status) ? "success-status" : status === "Cancelled" ? "danger" : "afip-status pending";

async function run(work: () => Promise<void>, message?: string) {
  if (busy.value) return;
  busy.value = true;
  try { await work(); if (message) notify(message); }
  catch (cause) { notify(apiError(cause), true); }
  finally { busy.value = false; }
}

async function load() {
  if (!auth.tenantId) return;
  try {
    const params = { tenantId: auth.tenantId, warehouseId: tenant.activeWarehouseId, pageSize: 100 };
    const [orderResponse, invoiceResponse, supplierResponse, productResponse] = await Promise.all([
      api.get<Purchase[]>("/purchases/orders"),
      api.get<PurchaseInvoice[]>("/purchases/invoices"),
      api.get<Supplier[]>("/suppliers", { params }),
      api.get<PagedResult<Product>>("/products", { params }),
    ]);
    orders.value = orderResponse.data;
    invoices.value = invoiceResponse.data;
    suppliers.value = supplierResponse.data;
    products.value = productResponse.data.items;
  } catch (cause) { notify(apiError(cause), true); }
}

function resetDraftLine() { Object.assign(draftLine, { productId: "", quantity: 1, unitCost: 0 }); }
function openOrder() { supplierId.value = ""; lines.value = []; resetDraftLine(); showOrderModal.value = true; }
function chooseProduct() { draftLine.unitCost = products.value.find(item => item.id === draftLine.productId)?.cost || 0; }
function addLine() {
  if (!supplierId.value) {
    notify("Seleccioná el proveedor antes de agregar productos.", true);
    return;
  }
  if (!draftLine.productId || draftLine.quantity < 1 || draftLine.unitCost < 0) {
    notify("Seleccioná un producto e ingresá cantidad y costo válidos.", true);
    return;
  }
  const existing = lines.value.find(item => item.productId === draftLine.productId);
  if (existing) {
    existing.quantity += draftLine.quantity;
    existing.unitCost = draftLine.unitCost;
  } else lines.value.push({ ...draftLine });
  resetDraftLine();
}
function removeLine(index: number) { lines.value.splice(index, 1); }
async function createOrder() {
  if (!supplierId.value || !lines.value.length) { notify("Seleccioná un proveedor y agregá al menos un ítem.", true); return; }
  await run(async () => {
    await api.post("/purchases/orders", { tenantId: auth.tenantId, warehouseId: tenant.activeWarehouseId, supplierId: supplierId.value, items: lines.value });
    showOrderModal.value = false;
    await load();
  }, isAdmin.value ? "Orden creada y pendiente de recepción." : "Orden creada y pendiente de autorización.");
}
async function viewOrder(order: Purchase) {
  try { selectedOrder.value = (await api.get<PurchaseDetail>(`/purchases/orders/${order.id}`)).data; }
  catch (cause) { notify(apiError(cause), true); }
}
async function printOrder(order: Purchase | PurchaseDetail) {
  try {
    const detail = "items" in order ? order : (await api.get<PurchaseDetail>(`/purchases/orders/${order.id}`)).data;
    const business = getPrintBusiness(auth.tenantId);
    const printed = printReceipt({
      tenantId: auth.tenantId,
      printFormat: "a4",
      businessName: business.name || tenant.businessName,
      businessTaxId: business.taxId || tenant.businessTaxId,
      receiptNumber: `OC-${detail.id.slice(0, 8).toUpperCase()}`,
      date: detail.createdAtUtc,
      customer: supplierName(detail.supplierId),
      paymentMethod: "Orden de compra",
      total: detail.totalAmount,
      items: detail.items.map(item => ({ product: item.product, quantity: item.quantity, unitPrice: item.unitCost, subtotal: item.totalAmount })),
      fiscalLabel: `ORDEN DE COMPRA · ${statusLabel(detail.status).toUpperCase()}`,
    });
    if (!printed) notify("El navegador bloqueó la ventana de impresión.", true);
  } catch (cause) { notify(apiError(cause), true); }
}
async function authorize(order: Purchase) {
  await run(async () => { await api.post(`/purchases/orders/${order.id}/authorize`, { tenantId: auth.tenantId, purchaseOrderId: order.id }); await load(); }, "Orden autorizada y pendiente de recepción.");
}
async function cancel(order: Purchase) {
  await run(async () => { await api.post(`/purchases/orders/${order.id}/cancel`, { tenantId: auth.tenantId, purchaseOrderId: order.id }); await load(); }, "Orden anulada.");
}
async function receive(order: Purchase) {
  await run(async () => { await api.post(`/purchases/orders/${order.id}/receive`, { tenantId: auth.tenantId, purchaseOrderId: order.id }); await load(); }, "Mercadería recibida y stock actualizado.");
}
function openInvoice(order: Purchase) { invoiceOrder.value = order; invoiceNumber.value = ""; showInvoiceModal.value = true; }
async function registerInvoice() {
  if (!invoiceOrder.value || !invoiceNumber.value.trim()) { notify("Ingresá el número de factura del proveedor.", true); return; }
  await run(async () => {
    await api.post("/purchases/invoices", { tenantId: auth.tenantId, purchaseOrderId: invoiceOrder.value!.id, number: invoiceNumber.value.trim() });
    showInvoiceModal.value = false;
    invoiceOrder.value = null;
    await load();
  }, "Factura de compra registrada.");
}
async function openAttachment(invoice: PurchaseInvoice) {
  const attachmentWindow = window.open("", "_blank");
  try {
    const response = await api.get(`/purchases/invoices/${invoice.id}/attachment`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    if (attachmentWindow) attachmentWindow.location.replace(url);
    else {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (cause) {
    attachmentWindow?.close();
    notify(apiError(cause), true);
  }
}
async function viewInvoice(invoice: PurchaseInvoice) {
  if (invoice.hasAttachment) { await openAttachment(invoice); return; }
  try { selectedInvoice.value = (await api.get<PurchaseInvoiceDetail>(`/purchases/invoices/${invoice.id}`)).data; }
  catch (cause) { notify(apiError(cause), true); }
}
async function uploadAttachment(invoice: PurchaseInvoice, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) {
    notify("Seleccioná un PDF de hasta 10 MB.", true);
    input.value = "";
    return;
  }
  await run(async () => {
    const body = new FormData();
    body.append("file", file);
    await api.post(`/purchases/invoices/${invoice.id}/attachment`, body, { timeout: 120_000 });
    await load();
  }, "PDF de factura adjuntado.");
  input.value = "";
}

function resetSupplier(target?: Supplier) {
  editingSupplier.value = target || null;
  Object.assign(supplier, { legalName: target?.legalName || "", taxId: target?.taxId || "", taxCondition: target?.taxCondition || "Responsable Inscripto", email: target?.email || "", phone: target?.phone || "", address: target?.address || "", isActive: target?.isActive ?? true });
}
function openSupplier(target?: Supplier, assignAfterCreate = false) { resetSupplier(target); selectCreatedSupplier.value = !target && assignAfterCreate; showSupplierModal.value = true; }
async function saveSupplier() {
  const editing = editingSupplier.value;
  await run(async () => {
    let id = "";
    if (editing) await api.put(`/suppliers/${editing.id}`, { tenantId: auth.tenantId, id: editing.id, ...supplier });
    else id = (await api.post<{ id: string }>("/suppliers", { tenantId: auth.tenantId, ...supplier })).data.id;
    showSupplierModal.value = false;
    await load();
    if (selectCreatedSupplier.value && id) supplierId.value = id;
    selectCreatedSupplier.value = false;
  }, editing ? "Proveedor actualizado." : "Proveedor creado.");
}
async function viewStatement(target: Supplier) {
  await run(async () => { statement.value = (await api.get(`/suppliers/${target.id}/account`, { params: { tenantId: auth.tenantId } })).data; });
}
watch([() => auth.tenantId, () => tenant.activeWarehouseId], () => void load(), { immediate: true });
</script>

<template>
  <div class="page-heading">
    <div><div class="breadcrumb">Tu negocio / Compras</div><h1>Compras y proveedores</h1><p>Gestioná órdenes, recepciones y facturas de proveedores.</p></div>
    <button v-if="tab === 'orders'" class="primary" @click="openOrder"><Plus :size="17" />Nueva orden de compra</button>
  </div>

  <div class="tabs"><button :class="{ active: tab === 'orders' }" @click="tab = 'orders'">Órdenes de compra</button><button :class="{ active: tab === 'invoices' }" @click="tab = 'invoices'">Facturas de proveedores</button><button :class="{ active: tab === 'suppliers' }" @click="tab = 'suppliers'">Proveedores</button></div>
  <p v-if="busy" class="empty-small"><LoaderCircle class="spin" />Procesando…</p>

  <section v-if="tab === 'orders'" class="panel">
    <div class="section-heading"><div><h2>Órdenes de compra</h2><p class="muted">Seguimiento de autorización, recepción y facturación.</p></div></div>
    <div class="responsive-table"><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      <tr v-for="order in orders" :key="order.id"><td>{{ dateTime(order.createdAtUtc) }}</td><td>{{ supplierName(order.supplierId) }}</td><td>{{ money(order.totalAmount) }}</td><td><span class="status" :class="statusClass(order.status)">{{ statusLabel(order.status) }}</span></td><td><div class="order-actions"><span class="invoice-actions"><button title="Ver detalle" aria-label="Ver detalle de la orden" @click="viewOrder(order)"><Eye :size="16" /></button><button title="Imprimir / Exportar PDF" aria-label="Imprimir orden de compra" @click="printOrder(order)"><Printer :size="16" /></button></span><button v-if="order.status === 'PendingAuthorization' && isAdmin" class="secondary" @click="authorize(order)"><Check :size="16" />Autorizar</button><button v-if="order.status === 'PendingAuthorization' && (isAdmin || order.createdByUserId === auth.user?.id)" class="secondary danger-action" @click="cancel(order)"><Ban :size="16" />Anular</button><button v-if="['PendingReceipt','Draft'].includes(order.status)" class="secondary" @click="receive(order)"><PackageCheck :size="16" />Recibir mercadería</button><button v-if="order.status === 'Received' && !order.invoiced" class="secondary" @click="openInvoice(order)"><FilePlus2 :size="16" />Registrar factura</button></div></td></tr>
      <tr v-if="!orders.length"><td colspan="5" class="empty-small">Todavía no hay órdenes de compra.</td></tr>
    </tbody></table></div>
  </section>

  <section v-if="tab === 'invoices'" class="panel">
    <div class="section-heading"><div><h2>Facturas de proveedores</h2><p class="muted">Facturas registradas a partir de órdenes recibidas.</p></div></div>
    <div class="responsive-table"><table><thead><tr><th>N.º factura</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Acciones</th></tr></thead><tbody>
      <tr v-for="invoice in invoices" :key="invoice.id"><td><strong>{{ invoice.number }}</strong></td><td>{{ invoice.supplier }}</td><td>{{ dateTime(invoice.issuedAtUtc) }}</td><td>{{ money(invoice.totalAmount) }}</td><td><div class="invoice-actions"><button :title="invoice.hasAttachment ? 'Abrir PDF adjunto' : 'Ver detalle'" :aria-label="`Ver factura ${invoice.number}`" @click="viewInvoice(invoice)"><Eye :size="16" /></button><label class="icon-upload" title="Adjuntar PDF"><Paperclip :size="16" /><input type="file" accept="application/pdf,.pdf" @change="uploadAttachment(invoice, $event)" /></label></div></td></tr>
      <tr v-if="!invoices.length"><td colspan="5" class="empty-small">Todavía no hay facturas de proveedores registradas.</td></tr>
    </tbody></table></div>
  </section>

  <section v-if="tab === 'suppliers'" class="panel">
    <div class="section-heading"><div><h2>Proveedores</h2><p class="muted">Datos comerciales y movimientos de cuenta.</p></div><button v-if="isAdmin" class="primary" @click="openSupplier()"><Plus :size="16" />Nuevo proveedor</button></div>
    <div class="responsive-table"><table><thead><tr><th>Proveedor</th><th>CUIT</th><th>Contacto</th><th>Email</th><th>Estado</th><th>Acciones</th></tr></thead><tbody><tr v-for="item in suppliers" :key="item.id"><td>{{ item.legalName }}</td><td>{{ item.taxId }}</td><td>{{ item.phone || 'Sin teléfono' }}<small>{{ item.address || 'Sin dirección' }}</small></td><td>{{ item.email || '—' }}</td><td><span class="status" :class="item.isActive ? 'success-status' : 'danger'">{{ item.isActive ? 'Activo' : 'Inactivo' }}</span></td><td><div class="invoice-actions"><button v-if="isAdmin" title="Editar proveedor" @click="openSupplier(item)"><Pencil :size="16" /></button><button v-if="isAdmin" title="Ver movimientos de cuenta" @click="viewStatement(item)"><ScrollText :size="16" /></button></div></td></tr></tbody></table></div>
    <article v-for="entry in statement" :key="entry.id" class="statement-line"><span>{{ dateTime(entry.occurredAtUtc) }} · {{ entry.description }}</span><strong>{{ money(entry.amount) }}</strong></article>
  </section>

  <div v-if="showOrderModal" class="modal-backdrop"><section class="modal purchase-modal"><button class="icon-button modal-close" aria-label="Cerrar" @click="showOrderModal = false"><X /></button><h2>Nueva orden de compra</h2><p>Las órdenes de administradores quedan listas para recepción; las de empleados requieren autorización.</p><form novalidate @submit.prevent="createOrder"><div class="supplier-picker"><label>Proveedor<select v-model="supplierId" :disabled="lines.length > 0" required><option value="" disabled>Seleccionar proveedor</option><option v-for="item in activeSuppliers" :key="item.id" :value="item.id">{{ item.legalName }}</option></select><small v-if="lines.length">El proveedor queda bloqueado mientras haya ítems cargados.</small></label><button v-if="isAdmin" type="button" class="secondary" :disabled="lines.length > 0" @click="openSupplier(undefined, true)"><Plus :size="16" />Nuevo proveedor</button></div><div class="entry-row"><label>Producto<select v-model="draftLine.productId" @change="chooseProduct"><option value="" disabled>Seleccionar producto</option><option v-for="product in selectableProducts" :key="product.id" :value="product.id">{{ product.sku }} · {{ product.name }} | Prov: {{ productSupplierName(product) }}</option></select><small v-if="supplierId && !selectableProducts.length">No hay productos asociados a este proveedor.</small></label><label>Cantidad<input v-model.number="draftLine.quantity" type="number" min="1" /></label><label>Costo unitario<CurrencyInput v-model="draftLine.unitCost" :min="0" /></label><button type="button" class="secondary add-item" @click="addLine"><Plus :size="16" />Agregar ítem</button></div><div class="item-grid"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th><th><span class="sr-only">Eliminar</span></th></tr></thead><tbody><tr v-for="(line, index) in lines" :key="line.productId"><td><strong>{{ productName(line.productId) }}</strong><small>{{ productSku(line.productId) }}</small></td><td>{{ line.quantity }}</td><td>{{ money(line.unitCost) }}</td><td>{{ money(line.quantity * line.unitCost) }}</td><td><button class="icon-button danger-button" type="button" title="Eliminar ítem" @click="removeLine(index)"><Trash2 :size="16" /></button></td></tr><tr v-if="!lines.length"><td colspan="5" class="empty-small">Agregá productos a la orden.</td></tr></tbody></table></div><div class="order-footer"><div><span>Total general</span><strong>{{ money(total) }}</strong></div><button class="primary" :disabled="busy || !lines.length"><Save :size="16" />Guardar orden</button></div></form></section></div>

  <div v-if="showInvoiceModal && invoiceOrder" class="modal-backdrop"><section class="modal compact-modal"><button class="icon-button modal-close" aria-label="Cerrar" @click="showInvoiceModal = false"><X /></button><h2>Registrar factura de proveedor</h2><p>{{ supplierName(invoiceOrder.supplierId) }} · {{ money(invoiceOrder.totalAmount) }}</p><form novalidate @submit.prevent="registerInvoice"><label>Número de factura<input v-model.trim="invoiceNumber" required maxlength="50" placeholder="0001-00000001" autofocus /></label><div class="modal-actions"><button type="button" class="secondary" @click="showInvoiceModal = false">Cancelar</button><button class="primary" :disabled="busy"><ReceiptText :size="16" />Registrar factura</button></div></form></section></div>
  <div v-if="selectedOrder" class="modal-backdrop"><section class="modal detail-modal"><button class="icon-button modal-close" aria-label="Cerrar" @click="selectedOrder = null"><X /></button><h2>Detalle de orden</h2><p><strong>{{ supplierName(selectedOrder.supplierId) }}</strong><br>{{ dateTime(selectedOrder.createdAtUtc) }} · {{ statusLabel(selectedOrder.status) }}</p><table class="detail-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Costo</th><th>Subtotal</th></tr></thead><tbody><tr v-for="item in selectedOrder.items" :key="item.productId"><td>{{ item.product }}<small>{{ item.sku }}</small></td><td>{{ item.quantity }}</td><td>{{ money(item.unitCost) }}</td><td>{{ money(item.totalAmount) }}</td></tr></tbody></table><div class="detail-total"><span>Total</span><strong>{{ money(selectedOrder.totalAmount) }}</strong></div><div class="modal-actions"><button class="secondary" @click="selectedOrder = null">Cerrar</button><button class="primary" @click="printOrder(selectedOrder)"><Printer :size="16" />Imprimir / Exportar PDF</button></div></section></div>
  <div v-if="selectedInvoice" class="modal-backdrop"><section class="modal detail-modal"><button class="icon-button modal-close" aria-label="Cerrar" @click="selectedInvoice = null"><X /></button><h2>Factura {{ selectedInvoice.number }}</h2><p><strong>{{ selectedInvoice.supplier }}</strong><br>{{ dateTime(selectedInvoice.issuedAtUtc) }}</p><table class="detail-table"><thead><tr><th>Producto</th><th>Cant.</th><th>Costo</th><th>Subtotal</th></tr></thead><tbody><tr v-for="item in selectedInvoice.items" :key="item.productId"><td>{{ item.product }}<small>{{ item.sku }}</small></td><td>{{ item.quantity }}</td><td>{{ money(item.unitCost) }}</td><td>{{ money(item.totalAmount) }}</td></tr></tbody></table><div class="detail-total"><span>Total</span><strong>{{ money(selectedInvoice.totalAmount) }}</strong></div><button class="secondary" @click="selectedInvoice = null">Cerrar</button></section></div>
  <div v-if="showSupplierModal" class="modal-backdrop"><section class="modal supplier-modal"><button class="icon-button modal-close" aria-label="Cerrar" @click="showSupplierModal = false"><X /></button><h2>{{ editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2><form novalidate @submit.prevent="saveSupplier"><div class="form-grid"><label>Razón social<input v-model.trim="supplier.legalName" required maxlength="150" autofocus /></label><label>CUIT<input v-model="supplier.taxId" required inputmode="numeric" maxlength="11" /></label><label>Email<input v-model.trim="supplier.email" type="email" /></label><label>Teléfono<input v-model.trim="supplier.phone" maxlength="30" /></label><label class="wide-field">Dirección<input v-model.trim="supplier.address" maxlength="300" /></label><label>Condición fiscal<select v-model="supplier.taxCondition"><option>Responsable Inscripto</option><option>Monotributo</option><option>Exento</option></select></label></div><label v-if="editingSupplier" class="supplier-active"><input v-model="supplier.isActive" type="checkbox" /><span><strong>Proveedor activo</strong><small>Podrá seleccionarse en nuevas órdenes.</small></span></label><div class="modal-actions"><button type="button" class="secondary" @click="showSupplierModal = false">Cancelar</button><button class="primary" :disabled="busy"><Save :size="16" />{{ busy ? 'Guardando…' : 'Guardar proveedor' }}</button></div></form></section></div>
</template>

<style scoped>
.tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0}.tabs button{padding:.6rem 1rem;border:1px solid #e2e8f0;border-radius:.6rem;background:#fff}.tabs button.active{background:#ec4899;color:#fff;border-color:#ec4899}.order-actions,.invoice-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem}.order-actions .secondary{padding:.45rem .65rem;font-size:.8rem}.danger-action{color:#be123c}.purchase-modal{width:min(100%,60rem);max-height:calc(100dvh - 24px);overflow:auto}.supplier-picker{display:flex;align-items:end;gap:.75rem}.supplier-picker label{flex:1}.entry-row{display:grid;grid-template-columns:2fr .8fr 1fr auto;gap:.7rem;align-items:end;margin:1.25rem 0}.add-item{height:2.9rem;white-space:nowrap}.item-grid{overflow-x:auto;border:1px solid #e2e8f0;border-radius:.8rem}.item-grid table{width:100%;border-collapse:collapse}.item-grid th,.item-grid td{padding:.7rem;text-align:left;border-bottom:1px solid #e2e8f0}.item-grid th:nth-child(n+2),.item-grid td:nth-child(n+2){text-align:right}.item-grid th:last-child,.item-grid td:last-child{text-align:center}.item-grid tr:last-child td{border-bottom:0}.item-grid small,.detail-table small,.responsive-table small{display:block;color:#64748b;margin-top:.2rem}.order-footer{display:flex;justify-content:space-between;align-items:center;margin-top:1rem;padding:1rem;background:#fdf2f8;border-radius:.75rem}.order-footer div{display:grid;gap:.15rem;color:#64748b}.order-footer strong{font-size:1.35rem;color:#be185d}.icon-upload{display:grid;place-items:center;width:2.25rem;height:2.25rem;border:1px solid #dbe3ef;border-radius:.7rem;color:#ec4899;cursor:pointer}.icon-upload input{display:none}.modal-actions{display:flex;justify-content:flex-end;align-items:center;gap:.65rem;margin-top:1rem}.supplier-modal,.detail-modal{width:min(100%,42rem)}.detail-table{width:100%;border-collapse:collapse;margin:1rem 0}.detail-table th,.detail-table td{padding:.65rem;border-bottom:1px solid #e2e8f0;text-align:left}.detail-table th:nth-child(n+2),.detail-table td:nth-child(n+2){text-align:right}.detail-total{display:flex;justify-content:space-between;margin:1rem 0;font-size:1.1rem}.supplier-active{display:flex;align-items:center;gap:.75rem;min-height:4.5rem;padding:.8rem 1rem;margin:.8rem 0;border:1px solid #e2e8f0;border-radius:.8rem;cursor:pointer}.supplier-active input{width:1.15rem;height:1.15rem;margin:0;accent-color:#ec4899}.supplier-active span{display:grid;gap:.2rem}.supplier-active small{color:#64748b}.wide-field{grid-column:span 2}.statement-line{display:flex;justify-content:space-between;gap:1rem;padding:.8rem 0;border-bottom:1px solid #e2e8f0}@media(max-width:760px){.entry-row{grid-template-columns:1fr 1fr}.entry-row>label:first-child{grid-column:1/-1}.add-item{width:100%}.supplier-picker{align-items:stretch;flex-direction:column}.wide-field{grid-column:span 1}.order-footer{align-items:stretch;flex-direction:column}.order-footer .primary{width:100%}.modal-actions{flex-wrap:wrap}}
</style>
