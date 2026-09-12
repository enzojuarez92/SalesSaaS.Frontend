<script setup lang="ts">
import { money } from "../services/format";
import CurrencyInput from "../components/CurrencyInput.vue";
import { computed, ref, watch } from "vue";
import {
  CheckCircle2,
  CircleAlert,
  CreditCard,
  DoorOpen,
  Landmark,
  LoaderCircle,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
  Printer,
  Mail,
  MessageCircle,
} from "lucide-vue-next";
import { api, apiError, notify } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type {
  AfipAuthorization,
  CashSession,
  Category,
  Customer,
  PagedResult,
  Product,
} from "../types/api";
type CartLine = Product & { quantity: number };
const auth = useAuthStore(),
  tenant = useTenantStore();
const products = ref<Product[]>([]),
  customers = ref<Customer[]>([]),
  categories = ref<Category[]>([]),
  cart = ref<CartLine[]>([]);
const productSearch = ref(""),
  selectedCategory = ref(""),
  customerSearch = ref(""),
  selectedCustomer = ref<Customer | null>(null);
const discountPercent = ref(0),
  payment = ref(1),
  documentType = ref(0),
  emitElectronically = ref(false),
  loading = ref(false),
  saving = ref(false),
  error = ref(""),
  success = ref("");
const invoiceId = ref(""),
  issuedOrderId = ref(""),
  invoiceNumber = ref(""),
  authorization = ref<AfipAuthorization | null>(null),
  showAfip = ref(false),
  showSuccess = ref(false),
  showCustomer = ref(false),
  showPayment = ref(false),
  cashOpen = ref(false),
  checkingCash = ref(false),
  showQuickOpen = ref(false),
  openingBalance = ref(0);
const issuedTotal = ref(0);
const saleSummary = ref("");
const isInternalTicket = ref(true);

watch(error, (message) => {
  if (!message) return;
  notify(message, true);
  error.value = "";
});
watch(success, (message) => {
  if (!message) return;
  notify(message);
  success.value = "";
});

const subtotal = computed(() =>
  cart.value.reduce((total, item) => total + item.price * item.quantity, 0),
);
const discount = computed(
  () =>
    Math.round(
      ((subtotal.value * Math.min(100, Math.max(0, discountPercent.value))) /
        100) *
        100,
    ) / 100,
);
const total = computed(() => subtotal.value - discount.value);
const net = computed(() => Math.round((total.value / 1.21) * 100) / 100);
const iva = computed(() => Math.round((total.value - net.value) * 100) / 100);
const visibleProducts = computed(() =>
  products.value.filter(
    (product) =>
      product.stock > 0 &&
      (!selectedCategory.value ||
        product.categoryId === selectedCategory.value) &&
      `${product.sku} ${product.name}`
        .toLowerCase()
        .includes(productSearch.value.toLowerCase()),
  ),
);
const visibleCustomers = computed(() =>
  customers.value
    .filter((customer) =>
      `${customer.name} ${customer.documentNumber}`
        .toLowerCase()
        .includes(customerSearch.value.toLowerCase()),
    )
    .slice(0, 8),
);
const availableCredit = computed(() =>
  selectedCustomer.value ? (selectedCustomer.value.availableCredit ?? 0) : 0,
);
const paymentOptions = [
  { value: 1, label: "Efectivo", icon: Wallet },
  { value: 4, label: "Transferencia", icon: Landmark },
  { value: 2, label: "Tarjeta", icon: CreditCard },
  { value: 6, label: "Cuenta corriente", icon: Wallet },
];
async function loadCatalogs() {
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  const params = {
    tenantId: auth.tenantId,
    warehouseId: tenant.activeWarehouseId,
    isActive: true,
    pageNumber: 1,
    pageSize: 100,
  };
  const [p, c, cat] = await Promise.allSettled([
    api.get<PagedResult<Product>>("/products", { params }),
    api.get<PagedResult<Customer>>("/customers", { params }),
    api.get<Category[]>("/categories", { params: { tenantId: auth.tenantId } }),
  ]);
  if (p.status === "fulfilled") products.value = p.value.data.items;
  else error.value = apiError(p.reason);
  if (c.status === "fulfilled") {
    customers.value = c.value.data.items;
    selectedCustomer.value ||=
      customers.value.find(
        (customer) => customer.documentNumber === "00000000",
      ) ||
      customers.value.find((customer) =>
        customer.taxCondition.toLowerCase().includes("consumidor"),
      ) ||
      null;
  } else error.value ||= apiError(c.reason);
  if (cat.status === "fulfilled") categories.value = cat.value.data;
  loadPendingQuote();
  loading.value = false;
}
function loadPendingQuote() {
  const stored = sessionStorage.getItem("salessaas.quote-to-load");
  if (!stored || !products.value.length || !customers.value.length) return;
  try {
    const quote = JSON.parse(stored) as {
      customerId: string;
      items: Array<{ productId: string; quantity: number }>;
    };
    const customer = customers.value.find((item) => item.id === quote.customerId);
    const lines = quote.items.map((item) => {
      const product = products.value.find((candidate) => candidate.id === item.productId);
      if (!product || product.stock < item.quantity)
        throw new Error("Uno o más productos del presupuesto no tienen stock suficiente en esta sucursal.");
      return { ...product, quantity: item.quantity };
    });
    if (!customer) throw new Error("El cliente del presupuesto no está disponible.");
    cart.value = lines;
    selectedCustomer.value = customer;
    customerSearch.value = "";
    discountPercent.value = 0;
    success.value = "Presupuesto cargado en el POS. Revisá el detalle y continuá con el cobro.";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "No pudimos cargar el presupuesto seleccionado.";
  } finally {
    sessionStorage.removeItem("salessaas.quote-to-load");
  }
}
async function checkCash() {
  if (!auth.tenantId || !tenant.activeWarehouseId) {
    cashOpen.value = false;
    return;
  }
  checkingCash.value = true;
  try {
    const { data } = await api.get<CashSession | "">("/cash/current", {
      params: {
        tenantId: auth.tenantId,
        warehouseId: tenant.activeWarehouseId,
      },
    });
    cashOpen.value = Boolean(
      data && typeof data === "object" && data.status === "Open",
    );
  } catch (cause) {
    cashOpen.value = false;
    error.value = apiError(cause);
  } finally {
    checkingCash.value = false;
  }
}
function openCashNow() {
  openingBalance.value = 0;
  error.value = "";
  showQuickOpen.value = true;
}
async function submitQuickOpen() {
  if (saving.value) return;
  if (!tenant.activeWarehouseId) {
    error.value = "Elegí un depósito antes de abrir la caja.";
    return;
  }
  if (openingBalance.value < 0) {
    error.value = "El fondo inicial no puede ser negativo.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await api.post("/cash/open", {
      tenantId: auth.tenantId,
      warehouseId: tenant.activeWarehouseId,
      openingBalance: openingBalance.value,
    });
    showQuickOpen.value = false;
    cashOpen.value = true;
    success.value =
      "Caja abierta correctamente. Ya podés continuar con la venta.";
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
function add(product: Product) {
  const item = cart.value.find((line) => line.id === product.id);
  if (item) {
    if (item.quantity < product.stock) item.quantity++;
  } else if (product.stock > 0) cart.value.push({ ...product, quantity: 1 });
}
function changeQuantity(item: CartLine, amount: number) {
  item.quantity = Math.max(1, Math.min(item.stock, item.quantity + amount));
}
function remove(id: string) {
  cart.value = cart.value.filter((item) => item.id !== id);
}
async function ensureConsumerFinal() {
  if (!auth.tenantId || selectedCustomer.value) return;
  const existing = customers.value.find(
    (customer) =>
      customer.documentNumber === "00000000" ||
      customer.taxCondition.toLowerCase().includes("consumidor"),
  );
  if (existing) {
    selectedCustomer.value = existing;
    return;
  }
  try {
    const { data } = await api.get<PagedResult<Customer>>("/customers", {
      params: {
        tenantId: auth.tenantId,
        searchTerm: "00000000",
        isActive: true,
        pageNumber: 1,
        pageSize: 1,
      },
    });
    if (data.items[0]) {
      selectedCustomer.value = data.items[0];
      return;
    }
    const created = await api.post("/customers", {
      tenantId: auth.tenantId,
      name: "Consumidor Final",
      legalName: "Consumidor Final",
      documentType: "DNI",
      documentNumber: "00000000",
      taxCondition: "Consumidor Final",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      creditLimit: 0,
      allowCredit: false,
    });
    const id = createdId(created);
    if (id) {
      const detail = await api.get<Customer>(`/customers/${id}`, {
        params: { tenantId: auth.tenantId },
      });
      customers.value.push(detail.data);
      selectedCustomer.value = detail.data;
    }
  } catch {
    /* A concurrent POS may have created it; the operator can still select a customer. */
  }
}
function selectCustomer(customer: Customer) {
  selectedCustomer.value = customer;
  customerSearch.value = "";
  showCustomer.value = false;
}
async function printReceipt() {
  if (!invoiceId.value || !auth.tenantId) return;
  error.value = "";
  const printWindow = window.open("", "_blank");
  try {
    const { data } = await api.get(`/invoices/${invoiceId.value}/pdf`, {
      params: { tenantId: auth.tenantId },
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    if (printWindow) printWindow.location.href = url;
    else window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (cause) {
    printWindow?.close();
    error.value = apiError(cause);
  }
}
function createdId(response: { data?: { id?: string }; headers?: unknown }) {
  const headers = response.headers as
    | { get?: (name: string, ...args: unknown[]) => unknown; location?: unknown }
    | undefined;
  const location = headers?.get?.("location") ?? headers?.location;
  return (
    response.data?.id ||
    (typeof location === "string" ? location.split("/").pop() : "") ||
    ""
  );
}async function openPayment() {
  if (!cart.value.length || !tenant.activeWarehouseId) {
    error.value = "Elegí un depósito y al menos un producto para continuar.";
    return;
  }
  await checkCash();
  if (!cashOpen.value) {
    error.value =
      "La caja está cerrada. Debes realizar la apertura de caja para comenzar a vender.";
    return;
  }
  await ensureConsumerFinal();
  if (!selectedCustomer.value) {
    error.value =
      "No pudimos preparar el cliente Consumidor Final. Intentá nuevamente.";
    return;
  }
  if (
    payment.value === 6 &&
    (!selectedCustomer.value.allowCredit || total.value > availableCredit.value)
  ) {
    error.value = "El cliente no tiene crédito disponible para esta venta.";
    return;
  }
  error.value = "";
  showPayment.value = true;
}
async function createSale() {
  if (saving.value || !cart.value.length || !tenant.activeWarehouseId) return;
  saving.value = true;
  error.value = "";
  success.value = "";
  authorization.value = null;
  invoiceId.value = "";
  invoiceNumber.value = "";
  const saleTotal = total.value;
  try {
    const payload = {
      tenantId: auth.tenantId,
      customerId: selectedCustomer.value!.id,
      warehouseId: tenant.activeWarehouseId,
      discountAmount: discount.value,
      paymentMethod: payment.value,
      items: cart.value.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    };
    const storageKey = `salessaas.pending-sale.${auth.tenantId}.${tenant.activeWarehouseId}`;
    const serialized = JSON.stringify(payload);
    let pending: { payload: string; id: string } | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch {
      /* Replace corrupt pending state. */
    }
    if (!pending || pending.payload !== serialized)
      pending = { payload: serialized, id: crypto.randomUUID() };
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
    const order = await api.post("/orders", {
      ...payload,
      requestId: pending.id,
    });
    sessionStorage.removeItem(storageKey);
    const orderId = createdId(order);
    if (!orderId)
      throw new Error(
        "La API no devolvió el identificador de la venta. Verificá Reportes antes de intentar nuevamente.",
      );
    issuedOrderId.value = orderId;
    issuedTotal.value = saleTotal;
    saleSummary.value = `Venta registrada por ${money(saleTotal)} con ${paymentOptions.find((option) => option.value === payment.value)?.label.toLowerCase()}.`;
    success.value = saleSummary.value;
    cart.value = [];
    showPayment.value = false;
    try {
      const { data: invoice } = await api.post<{
        invoiceId: string;
        number: string;
        status: string;
        voucherType: number | null;
        cae: string | null;
        caeExpirationDate: string | null;
        qrUrl: string | null;
        errors: string | null;
      }>("/invoices/issue", {
        tenantId: auth.tenantId,
        orderId,
        documentType: emitElectronically.value ? documentType.value : 7,
      });
      invoiceId.value = invoice.invoiceId;
      invoiceNumber.value = invoice.number;
      isInternalTicket.value = invoice.voucherType === null;
      authorization.value = {
        invoiceId: invoice.invoiceId,
        isApproved: invoice.status === "Issued" && Boolean(invoice.cae),
        cae: invoice.cae,
        caeExpirationDate: invoice.caeExpirationDate,
        barCode: invoice.qrUrl,
        errors: invoice.errors,
      };
      if (invoice.errors)
        error.value = `La venta fue registrada, pero ARCA no pudo autorizar el comprobante. ${invoice.errors}`;
    } catch (cause) {
      error.value = `La venta ${orderId} ya está guardada. No se pudo completar la emisión electrónica: ${apiError(cause)}. No vuelvas a cobrar esta venta.`;
    }
    showSuccess.value = true;
    await loadCatalogs();
  } catch (cause) {
    error.value = apiError(cause);
    await checkCash();
  } finally {
    saving.value = false;
  }
}
async function authorize() {
  if (!issuedOrderId.value) return;
  saving.value = true;
  error.value = "";
  try {
    const { data: invoice } = await api.post<{
      invoiceId: string; status: string; cae: string | null; caeExpirationDate: string | null; qrUrl: string | null; errors: string | null;
    }>("/invoices/issue", {
        tenantId: auth.tenantId,
        orderId: issuedOrderId.value,
        documentType: documentType.value,
      },
    );
    invoiceId.value = invoice.invoiceId;
    authorization.value = { invoiceId: invoice.invoiceId, isApproved: invoice.status === "Issued" && Boolean(invoice.cae), cae: invoice.cae, caeExpirationDate: invoice.caeExpirationDate, barCode: invoice.qrUrl, errors: invoice.errors };
    if (invoice.errors) error.value = invoice.errors;
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    showAfip.value = true;
    saving.value = false;
  }
}
watch(() => auth.tenantId, loadCatalogs, { immediate: true });
watch(customers, () => {
  void ensureConsumerFinal();
});
watch(
  () => tenant.warehouses,
  (warehouses) => {
    if (!tenant.activeWarehouseId && warehouses.length === 1)
      tenant.activeWarehouseId = warehouses[0].id;
  },
  { immediate: true },
);
watch(
  () => tenant.activeWarehouseId,
  () => {
    cart.value = [];
    selectedCustomer.value = null;
    products.value = [];
    showPayment.value = false;
    void loadCatalogs();
    void checkCash();
  },
  { immediate: true },
);
async function saveQuote() {
  if (saving.value || !cart.value.length) return;
  if (discount.value > 0) {
    error.value =
      "Los presupuestos guardan precios de catálogo. Quitá el descuento para continuar.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await ensureConsumerFinal();
    if (!selectedCustomer.value) throw new Error();
    await api.post("/sales/quotes", {
      tenantId: auth.tenantId,
      customerId: selectedCustomer.value.id,
      expiresAtUtc: new Date(Date.now() + 7 * 86400000).toISOString(),
      items: cart.value.map((i) => ({ productId: i.id, quantity: i.quantity })),
    });
    success.value =
      "Presupuesto guardado por 7 días. Podés consultarlo en Presupuestos. No se cobró ni descontó stock.";
  } catch (e) {
    error.value = apiError(e);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Ventas</div>
      <h1>Punto de venta</h1>
      <p>Armá el comprobante y cobrá. La emisión en ARCA es opcional.</p>
    </div>
    <span class="badge">POS</span>
  </div>
  <section
    v-if="!checkingCash && !cashOpen"
    class="cash-closed-alert"
    role="alert"
  >
    <CircleAlert :size="21" />
    <div>
      <strong>La caja está cerrada</strong
      ><span>Debes realizar la apertura de caja para comenzar a vender.</span>
    </div>
    <button
      class="primary"
      :disabled="!tenant.activeWarehouseId"
      @click="openCashNow"
    >
      <DoorOpen :size="17" />Abrir caja ahora
    </button>
  </section>
  <div class="pos-layout" :aria-busy="loading">
    <section class="panel pos-catalog">
      <div class="section-heading">
        <div>
          <h2>Productos</h2>
          <p>Buscá y agregá en un toque</p>
        </div>
        <Search :size="19" class="muted" />
      </div>
      <label class="search-input"
        ><Search :size="17" /><input
          v-model="productSearch"
          placeholder="Buscar por nombre o SKU"
      /></label>
      <div class="category-chips">
        <button
          :class="{ active: !selectedCategory }"
          @click="selectedCategory = ''"
        >
          Todos</button
        ><button
          v-for="category in categories"
          :key="category.id"
          :class="{ active: selectedCategory === category.id }"
          @click="selectedCategory = category.id"
        >
          {{ category.name }}
        </button>
      </div>
      <div v-if="loading" class="empty-small">
        <LoaderCircle class="spin" /> Cargando catálogo…
      </div>
      <div v-else class="product-picker">
        <button
          v-for="product in visibleProducts"
          :key="product.id"
          class="product-choice"
          :disabled="product.stock === 0"
          @click="add(product)"
        >
          <span
            ><strong>{{ product.name }}</strong
            ><small
              >{{ product.sku }} · {{ product.stock }} disponibles</small
            ></span
          ><strong>{{ money(product.price) }}</strong
          ><Plus :size="17" />
        </button>
        <p v-if="!visibleProducts.length" class="empty-small">
          No encontramos productos activos.
        </p>
      </div>
    </section>
    <section class="panel pos-cart">
      <div class="section-heading">
        <div>
          <h2>Venta actual</h2>
          <p>
            {{
              cart.length
                ? `${cart.length} producto(s) en el comprobante`
                : "Sumá productos para comenzar"
            }}
          </p>
        </div>
        <ShoppingCart :size="20" class="muted" />
      </div>
      <div class="customer-select">
        <label
          >Cliente<input
            v-model="customerSearch"
            placeholder="Buscar cliente"
            @focus="showCustomer = true" /></label
        ><button
          v-if="selectedCustomer"
          class="selected-customer"
          @click="selectedCustomer = null"
        >
          <span
            >{{ selectedCustomer.name
            }}<small>{{ selectedCustomer.documentNumber }}</small></span
          ><X :size="16" />
        </button>
        <div v-if="showCustomer && customerSearch" class="customer-results">
          <button
            v-for="customer in visibleCustomers"
            :key="customer.id"
            @click="selectCustomer(customer)"
          >
            <strong>{{ customer.name }}</strong
            ><small>{{ customer.documentNumber }}</small>
          </button>
          <p v-if="!visibleCustomers.length">No hay coincidencias.</p>
        </div>
      </div>
      <label
        >Depósito / sucursal<select v-model="tenant.activeWarehouseId">
          <option value="">Elegí un depósito</option>
          <option
            v-for="warehouse in tenant.warehouses"
            :key="warehouse.id"
            :value="warehouse.id"
          >
            {{ warehouse.name }}
          </option>
        </select></label
      >
      <div class="cart-lines">
        <div v-for="item in cart" :key="item.id" class="cart-line">
          <div>
            <strong>{{ item.name }}</strong
            ><small>{{ money(item.price) }} c/u · stock {{ item.stock }}</small>
          </div>
          <div class="quantity">
            <button @click="changeQuantity(item, -1)">
              <Minus :size="14" /></button
            ><span>{{ item.quantity }}</span
            ><button
              :disabled="item.quantity >= item.stock"
              @click="changeQuantity(item, 1)"
            >
              <Plus :size="14" />
            </button>
          </div>
          <strong>{{ money(item.price * item.quantity) }}</strong
          ><button class="icon-button" @click="remove(item.id)">
            <Trash2 :size="17" />
          </button>
        </div>
        <p v-if="!cart.length" class="empty-small">
          El detalle de la venta aparecerá aquí.
        </p>
      </div>
      <label class="discount-control"
        >Descuento (%)<input
          v-model.number="discountPercent"
          type="number"
          min="0"
          max="100"
          step="1"
      /></label>
      <div class="totals">
        <span
          >Subtotal <strong>{{ money(subtotal) }}</strong></span
        ><span v-if="discount"
          >Descuento <strong>-{{ money(discount) }}</strong></span
        ><span
          >IVA 21% <strong>{{ money(iva) }}</strong></span
        ><span class="total"
          >Total <strong>{{ money(total) }}</strong></span
        >
      </div>
      <button
        class="primary full"
        :disabled="saving || checkingCash || !cashOpen || !cart.length"
        @click="openPayment"
      >
        <LoaderCircle v-if="checkingCash" class="spin" :size="17" /><CreditCard
          v-else
          :size="17"
        />{{ cashOpen ? "Ir a cobrar" : "Abrí la caja para cobrar" }}</button
      ><button
        class="secondary full"
        :disabled="saving || !cart.length"
        @click="saveQuote"
      >
        Guardar presupuesto</button
      ><button
        v-if="invoiceId"
        class="secondary full"
        :disabled="saving"
        @click="authorize"
      >
        <CheckCircle2 :size="17" />Autorizar en ARCA
      </button>
    </section>
  </div>
  <div
    v-if="showQuickOpen"
    class="modal-backdrop"
    @click.self="showQuickOpen = false"
  >
    <section class="modal">
      <button class="icon-button modal-close" @click="showQuickOpen = false">
        <X />
      </button>
      <div class="modal-icon"><DoorOpen /></div>
      <h2>Abrir caja</h2>
      <p>
        Ingresá el fondo inicial para habilitar las ventas en este depósito.
      </p>
      <form novalidate @submit.prevent="submitQuickOpen">
        <label
          >Fondo inicial<CurrencyInput
            v-model="openingBalance"
            :min="0"
            autofocus /></label
        ><button class="primary full" :disabled="saving">
          <LoaderCircle v-if="saving" class="spin" :size="16" />{{
            saving ? "Abriendo…" : "Abrir caja y continuar"
          }}
        </button>
      </form>
    </section>
  </div>
  <div
    v-if="showPayment"
    class="modal-backdrop"
    @click.self="showPayment = false"
  >
    <section class="modal">
      <button class="icon-button modal-close" @click="showPayment = false">
        <X />
      </button>
      <div class="modal-icon"><CreditCard /></div>
      <h2>Confirmá el cobro</h2>
      <p>Seleccioná el medio de pago de esta venta.</p>
      <div class="payment-methods">
        <button
          v-for="option in paymentOptions"
          :key="option.value"
          :disabled="
            option.value === 6 &&
            (!selectedCustomer?.allowCredit || total > availableCredit)
          "
          :class="{ active: payment === option.value }"
          @click="payment = option.value"
        >
          <component :is="option.icon" :size="20" /><span
            >{{ option.label
            }}<small v-if="option.value === 6"
              >Disponible: {{ money(availableCredit) }}</small
            ></span
          ><CheckCircle2 v-if="payment === option.value" :size="17" />
        </button>
      </div>
      <label class="fiscal-toggle">
        <input v-model="emitElectronically" type="checkbox" />
        <span><strong>Emitir factura electrónica en ARCA</strong><small>Si no la activás, se genera un ticket interno / no fiscal.</small></span>
      </label>
      <label v-if="emitElectronically"
        >Tipo de comprobante<select v-model.number="documentType">
          <option :value="0">Automático según condición fiscal</option>
          <option :value="1">Factura A</option>
          <option :value="2">Factura B</option>
          <option :value="3">Factura C</option>
        </select></label
      >
      <div class="checkout-total">
        Total a cobrar <strong>{{ money(total) }}</strong>
      </div>
      <button class="primary full" :disabled="saving" @click="createSale">
        <LoaderCircle v-if="saving" class="spin" :size="17" /><ReceiptText
          v-else
          :size="17"
        />{{ saving ? "Registrando…" : "Confirmar venta" }}
      </button>
    </section>
  </div>
  <div
    v-if="showSuccess"
    class="modal-backdrop"
    @click.self="showSuccess = false"
  >
    <section class="modal">
      <button class="icon-button modal-close" @click="showSuccess = false">
        <X />
      </button>
      <div class="modal-icon approved"><CheckCircle2 /></div>
      <h2>Venta exitosa</h2>
      <p>{{ saleSummary }}</p>
      <dl class="authorization-data">
        <div>
          <dt>Comprobante</dt>
          <dd>{{ invoiceNumber || invoiceId }}</dd>
        </div>
        <div v-if="authorization?.cae">
          <dt>CAE</dt>
          <dd>{{ authorization.cae }}</dd>
        </div>
        <div v-else>
          <dt>Tipo</dt>
          <dd>{{ isInternalTicket ? "Ticket interno / no fiscal" : "Comprobante electrónico pendiente" }}</dd>
        </div>
      </dl>
      <div class="receipt-actions">
        <button
          class="receipt-icon"
          title="Abrir comprobante para imprimir"
          :disabled="!invoiceId || saving"
          aria-label="Abrir comprobante para imprimir"
          @click="printReceipt"
        >
          <Printer :size="21" /></button
        ><a
          v-if="selectedCustomer?.email"
          :href="`mailto:${selectedCustomer.email}?subject=Comprobante%20de%20compra&body=Adjuntamos%20tu%20comprobante%20${invoiceNumber || invoiceId}`"
          ><Mail :size="17" />Email</a
        ><a
          :href="`https://wa.me/?text=${encodeURIComponent(`Comprobante ${invoiceNumber || invoiceId} por ${money(issuedTotal)}`)}`"
          target="_blank"
          rel="noopener"
          ><MessageCircle :size="17" />WhatsApp</a
        >
      </div>
      <button class="primary full" @click="showSuccess = false">
        Finalizar
      </button>
    </section>
  </div>
  <div v-if="showAfip" class="modal-backdrop" @click.self="showAfip = false">
    <section class="modal">
      <button class="icon-button modal-close" @click="showAfip = false">
        <X />
      </button>
      <div
        class="modal-icon"
        :class="authorization?.isApproved ? 'approved' : 'rejected'"
      >
        <CheckCircle2 v-if="authorization?.isApproved" /><ReceiptText v-else />
      </div>
      <h2>
        {{
          authorization?.isApproved ? "Factura autorizada" : "Resultado de ARCA"
        }}
      </h2>
      <p>
        {{
          authorization?.isApproved
            ? "El comprobante fue autorizado correctamente."
            : authorization?.errors ||
              error ||
              "No pudimos obtener una autorización."
        }}
      </p>
      <dl v-if="authorization?.isApproved" class="authorization-data">
        <div>
          <dt>CAE</dt>
          <dd>{{ authorization.cae }}</dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>{{ authorization.caeExpirationDate }}</dd>
        </div>
      </dl>
      <button class="primary full" @click="showAfip = false">Entendido</button>
    </section>
  </div>
</template>
<style scoped>
.cash-closed-alert {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 0 0 1rem;
  padding: 1rem;
  border: 1px solid #fbbf24;
  border-radius: 0.85rem;
  background: #fffbeb;
  color: #92400e;
}
.cash-closed-alert > div {
  display: grid;
  gap: 0.15rem;
  flex: 1;
}
.cash-closed-alert span {
  font-size: 0.88rem;
}
.cash-closed-alert .primary {
  flex: none;
}
.fiscal-toggle {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  margin-top: 1rem;
  padding: 0.8rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  cursor: pointer;
}
.fiscal-toggle input {
  width: 1.05rem;
  height: 1.05rem;
  margin-top: 0.1rem;
  accent-color: #db2777;
}
.fiscal-toggle span { display: grid; gap: 0.15rem; }
.fiscal-toggle strong { font-size: 0.9rem; }
.fiscal-toggle small { color: #64748b; font-size: 0.78rem; }
.receipt-actions {
  display: grid;
  grid-template-columns: 52px repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 1rem 0;
  width: 100%;
}
.receipt-actions button,
.receipt-actions a {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 48px;
  padding: 0.45rem;
  border: 1px solid #f9a8d4;
  border-radius: 0.55rem;
  color: #be185d;
  background: #fff;
  text-decoration: none;
  font-size: 0.82rem;
  white-space: nowrap;
}
.receipt-actions .receipt-icon {
  padding: 0;
  color: #db2777;
  border-color: #f472b6;
  background: #fdf2f8;
}
.receipt-actions .receipt-icon:hover,
.receipt-actions a:hover {
  background: #fdf2f8;
}
@media (max-width: 600px) {
  .cash-closed-alert {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .cash-closed-alert .primary {
    width: 100%;
  }
  .receipt-actions {
    grid-template-columns: 52px 1fr;
  }
  .receipt-actions a:last-child {
    grid-column: 1/-1;
  }
  .receipt-actions button,
  .receipt-actions a {
    font-size: 0.9rem;
  }
}
</style>
