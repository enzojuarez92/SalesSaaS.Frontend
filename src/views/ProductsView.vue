<script setup lang="ts">
import InventoryTools from "../components/InventoryTools.vue";
import CurrencyInput from "../components/CurrencyInput.vue";
import { money } from "../services/format";
import { computed, nextTick, reactive, ref, watch } from "vue";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useTenantStore } from "../stores/tenant";
import type { Category, PagedResult, Product } from "../types/api";
import { nonNegative, requiredText } from "../utils/validation";
const auth = useAuthStore(),
  tenant = useTenantStore();
const products = ref<Product[]>([]),
  categories = ref<Category[]>([]),
  page = ref(1),
  totalPages = ref(1),
  totalCount = ref(0),
  search = ref(""),
  categoryFilter = ref(""),
  stockFilter = ref(""),
  loading = ref(false),
  saving = ref(false),
  error = ref(""),
  success = ref(""),
  showModal = ref(false),
  showAdjustment = ref(false),
  showCategoryModal = ref(false),
  skuInput = ref<HTMLInputElement | null>(null),
  editingId = ref<string | null>(null),
  adjusting = ref<Product | null>(null);
const form = reactive({
  sku: "",
  name: "",
  description: "",
  price: 0,
  cost: 0,
  vatRate: 21,
  stock: 0,
  minimumStockAlert: 0,
  categoryId: "",
});
const adjustment = reactive({
  warehouseId: "",
  type: 3,
  quantity: 1,
  reason: "",
});
const quickCategory = reactive({ name: "", description: "" });
const fieldErrors = reactive<Record<string, string>>({});
const canManage = computed(() =>
  ["Owner", "Admin", "Warehouse"].includes(auth.user?.role || ""),
);

async function loadCategories() {
  if (!auth.tenantId || !canManage.value) return;
  try {
    categories.value = (
      await api.get<Category[]>("/categories", {
        params: { tenantId: auth.tenantId },
      })
    ).data.filter((category) => category.isActive);
  } catch {
    categories.value = [];
  }
}
async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<PagedResult<Product>>("/products", {
      params: {
        tenantId: auth.tenantId,
        warehouseId: tenant.activeWarehouseId || undefined,
        searchTerm: search.value || undefined,
        categoryId: categoryFilter.value || undefined,
        stockStatus: stockFilter.value || undefined,
        isActive: true,
        pageNumber: page.value,
        pageSize: 10,
      },
    });
    products.value = data.items;
    totalCount.value = data.totalCount;
    totalPages.value = Math.max(1, data.totalPages);
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    loading.value = false;
  }
}
function open(product?: Product) {
  editingId.value = product?.id || null;
  Object.assign(
    form,
    product
      ? {
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
          cost: product.cost,
          vatRate: product.vatRate,
          stock: product.stock,
          minimumStockAlert: product.minimumStockAlert,
          categoryId: product.categoryId || "",
        }
      : {
          sku: "",
          name: "",
          description: "",
          price: 0,
          cost: 0,
          vatRate: 21,
          stock: 0,
          minimumStockAlert: 0,
          categoryId: "",
        },
  );
  error.value = "";
  clearFieldErrors();
  showModal.value = true;
  if (!product) void nextTick(() => skuInput.value?.focus());
}
function submitBarcodeSearch() {
  if (!search.value.trim()) return;
  page.value = 1;
  void load();
}
function clearFieldErrors() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
}
function clearFieldError(field: string) {
  if (fieldErrors[field]) delete fieldErrors[field];
}
function openAdjustment(product: Product) {
  adjusting.value = product;
  Object.assign(adjustment, {
    warehouseId: tenant.activeWarehouseId,
    type: 3,
    quantity: 1,
    reason: "",
  });
  error.value = "";
  showAdjustment.value = true;
}
function validate() {
  clearFieldErrors();
  fieldErrors.sku = requiredText(form.sku, "El SKU", 50);
  fieldErrors.name = requiredText(form.name, "El nombre", 150);
  fieldErrors.price = form.price > 0 ? "" : "Ingresá un precio de venta mayor a cero.";
  fieldErrors.cost = nonNegative(form.cost, "El costo");
  fieldErrors.vatRate = [0, 10.5, 21].includes(form.vatRate)
    ? ""
    : "Elegí una alícuota de IVA válida.";
  fieldErrors.stock = nonNegative(form.stock, "El stock inicial");
  fieldErrors.minimumStockAlert = nonNegative(form.minimumStockAlert, "La alerta mínima");
  return !Object.values(fieldErrors).some(Boolean);
}
async function save() {
  if (!validate()) {
    error.value = "Revisá los campos marcados para continuar.";
    return;
  }
  if (!editingId.value && form.stock > 0 && !tenant.activeWarehouseId) {
    error.value = "Elegí un depósito antes de asignar stock inicial.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const payload = {
      tenantId: auth.tenantId,
      ...form,
      categoryId: form.categoryId || null,
      brandId: null,
      initialWarehouseId: editingId.value
        ? null
        : tenant.activeWarehouseId || null,
    };
    if (editingId.value)
      await api.put(`/products/${editingId.value}`, {
        id: editingId.value,
        ...payload,
      });
    else await api.post("/products", payload);
    showModal.value = false;
    success.value = "Producto guardado correctamente.";
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
function openQuickCategory() {
  quickCategory.name = "";
  quickCategory.description = "";
  error.value = "";
  showCategoryModal.value = true;
}
async function saveQuickCategory() {
  if (!quickCategory.name.trim()) {
    error.value = "El nombre de la categoría es obligatorio.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    const { data } = await api.post<{ id: string }>("/categories", {
      tenantId: auth.tenantId,
      name: quickCategory.name.trim(),
      description: quickCategory.description.trim() || null,
    });
    await loadCategories();
    form.categoryId = data.id;
    showCategoryModal.value = false;
    success.value = "Categoría creada y asignada al producto.";
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
async function saveAdjustment() {
  if (
    !adjusting.value ||
    !adjustment.warehouseId ||
    adjustment.quantity <= 0 ||
    !adjustment.reason.trim()
  ) {
    error.value =
      "Elegí el depósito, indicá una cantidad y el motivo del ajuste.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await api.post(`/products/${adjusting.value.id}/stock-adjustment`, {
      tenantId: auth.tenantId,
      productId: adjusting.value.id,
      warehouseId: adjustment.warehouseId,
      type: adjustment.type,
      quantity: adjustment.quantity,
      reason: adjustment.reason,
      reference: null,
    });
    showAdjustment.value = false;
    success.value = "Ajuste de stock registrado.";
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
let timer: ReturnType<typeof setTimeout> | undefined;
watch([search, categoryFilter, stockFilter], () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
});
watch(
  () => auth.tenantId,
  () => {
    page.value = 1;
    void load();
    void loadCategories();
  },
  { immediate: true },
);
watch(
  () => tenant.activeWarehouseId,
  () => {
    page.value = 1;
    void load();
  },
);
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Inventario</div>
      <h1>Productos e inventario</h1>
      <p>Controlá el catálogo y registrá cada ajuste de stock.</p>
    </div>
    <button v-if="canManage" class="primary" @click="open()">
      <PackagePlus :size="17" />Nuevo producto
    </button>
  </div>
  <p v-if="error && !showModal && !showAdjustment" class="error" role="alert">
    {{ error }}
  </p>
  <p v-if="success" class="success" role="status">{{ success }}</p>
  <InventoryTools v-if="canManage" @updated="load" />
  <section class="panel inventory-panel">
    <div class="inventory-toolbar">
      <label class="search-input product-search"
        ><Search :size="17" /><input
          v-model="search"
          placeholder="Buscar por SKU, código de barras o nombre"
          @keydown.enter.prevent="submitBarcodeSearch" /></label
      ><select class="product-filter" v-model="categoryFilter" aria-label="Filtrar por categoría">
        <option value="">Todas las categorías</option>
        <option
          v-for="category in categories"
          :key="category.id"
          :value="category.id"
        >
          {{ category.name }}
        </option></select
      ><select class="product-filter" v-model="stockFilter" aria-label="Filtrar por stock">
        <option value="">Todo el stock</option>
        <option value="available">Disponible</option>
        <option value="low">Stock bajo</option>
        <option value="out">Sin stock</option></select
      ><span>{{ totalCount }} producto(s)</span>
    </div>
    <div v-if="loading" class="empty-small">
      <LoaderCircle class="spin" /> Actualizando inventario…
    </div>
    <div v-else class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th v-if="canManage">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td data-label="Producto">
              <strong>{{ product.name }}</strong
              ><small>{{ product.sku }}</small>
            </td>
            <td data-label="Categoría">
              {{
                categories.find(
                  (category) => category.id === product.categoryId,
                )?.name || "Sin categoría"
              }}
            </td>
            <td data-label="Precio">{{ money(product.price) }}</td>
            <td data-label="Stock">
              <strong
                :class="{
                  'stock-alert': product.stock <= product.minimumStockAlert,
                }"
                >{{ product.stock }}</strong
              ><small>mín. {{ product.minimumStockAlert }}</small>
            </td>
            <td data-label="Estado">
              <span v-if="product.stock === 0" class="status danger"
                ><AlertTriangle :size="13" />Sin stock</span
              ><span
                v-else-if="product.stock <= product.minimumStockAlert"
                class="afip-status pending"
                ><AlertTriangle :size="13" />Stock bajo</span
              ><span v-else class="status success-status">Disponible</span>
            </td>
            <td v-if="canManage" data-label="Acciones">
              <div class="invoice-actions">
                <InventoryTools
                  :product-id="product.id"
                  :product-name="product.name"
                  compact
                /><button
                  :aria-label="`Ajustar ${product.name}`"
                  @click="openAdjustment(product)"
                >
                  <SlidersHorizontal :size="16" /></button
                ><button
                  :aria-label="`Editar ${product.name}`"
                  @click="open(product)"
                >
                  <Pencil :size="16" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!products.length">
            <td :colspan="canManage ? 6 : 5">
              <p class="empty-small">
                No hay productos que coincidan con esta búsqueda.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <button
        class="icon-button"
        :disabled="page === 1"
        @click="
          page--;
          load();
        "
      >
        <ChevronLeft /></button
      ><span>Página {{ page }} de {{ totalPages }}</span
      ><button
        class="icon-button"
        :disabled="page === totalPages"
        @click="
          page++;
          load();
        "
      >
        <ChevronRight />
      </button>
    </div>
  </section>
  <div v-if="showModal" class="modal-backdrop">
    <section class="modal product-modal">
      <button class="icon-button modal-close" @click="showModal = false">
        <X />
      </button>
      <h2>{{ editingId ? "Editar producto" : "Nuevo producto" }}</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <form novalidate @submit.prevent="save">
        <div class="form-grid">
          <label
            >SKU<input
              ref="skuInput"
              v-model.trim="form.sku"
              maxlength="50"
              autofocus
              :aria-invalid="!!fieldErrors.sku"
              @input="clearFieldError('sku')" /><small
              v-if="fieldErrors.sku"
              class="field-error"
              role="alert"
              >{{ fieldErrors.sku }}</small
            ></label
          ><label
            >Nombre<input
              v-model.trim="form.name"
              maxlength="150"
              :aria-invalid="!!fieldErrors.name"
              @input="clearFieldError('name')" /><small
              v-if="fieldErrors.name"
              class="field-error"
              role="alert"
              >{{ fieldErrors.name }}</small
            ></label
          ><label class="wide"
            >Categoría<span class="category-field"
              ><select v-model="form.categoryId">
                <option value="">Sin categoría</option>
                <option
                  v-for="category in categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option></select
              ><button
                class="secondary icon-button"
                type="button"
                aria-label="Crear categoría"
                title="Crear categoría"
                @click="openQuickCategory"
              >
                <Plus :size="17" /></button></span
          ></label>
        </div>
        <label
          >Descripción<textarea
            v-model="form.description"
            maxlength="500"
          ></textarea>
        </label>
        <div class="form-grid">
          <label
            >Precio de venta<CurrencyInput
              v-model="form.price"
              :min="0.01"
              :aria-invalid="!!fieldErrors.price"
              @input="clearFieldError('price')" /><small
              v-if="fieldErrors.price"
              class="field-error"
              role="alert"
              >{{ fieldErrors.price }}</small
            ></label
          ><label
            >IVA<select v-model.number="form.vatRate">
              <option :value="21">21%</option>
              <option :value="10.5">10,5%</option>
              <option :value="0">0%</option>
            </select></label
          ><label
            >Costo<CurrencyInput
              v-model="form.cost"
              :min="0"
              :aria-invalid="!!fieldErrors.cost"
              @input="clearFieldError('cost')" /><small
              v-if="fieldErrors.cost"
              class="field-error"
              role="alert"
              >{{ fieldErrors.cost }}</small
            ><small
              v-else
              class="input-hint-space"
              aria-hidden="true"
              >&nbsp;</small
            ></label
          ><label
            >Stock inicial<input
              class="quantity-input"
              v-model.number="form.stock"
              type="number"
              min="0"
              step="1"
              :disabled="Boolean(editingId)"
              :aria-invalid="!!fieldErrors.stock"
              @input="clearFieldError('stock')" /><small
              v-if="fieldErrors.stock"
              class="field-error"
              role="alert"
              >{{ fieldErrors.stock }}</small
            ><small v-if="!editingId"
              >Se asignará a
              {{
                tenant.warehouses.find((w) => w.id === tenant.activeWarehouseId)
                  ?.name || "el depósito seleccionado"
              }}.</small
            ><small v-else
              >Usá Ajustar stock para registrar el movimiento.</small
            ></label
          ><label
            >Alerta mínima<input
              class="quantity-input"
              v-model.number="form.minimumStockAlert"
              type="number"
              min="0"
              step="1"
              :aria-invalid="!!fieldErrors.minimumStockAlert"
              @input="clearFieldError('minimumStockAlert')" /><small
              v-if="fieldErrors.minimumStockAlert"
              class="field-error"
              role="alert"
              >{{ fieldErrors.minimumStockAlert }}</small
          ></label>
        </div>
        <button class="primary full" :disabled="saving">
          <LoaderCircle v-if="saving" class="spin" :size="16" />{{
            saving ? "Guardando…" : "Guardar producto"
          }}
        </button>
      </form>
    </section>
  </div>
  <div
    v-if="showCategoryModal"
    class="modal-backdrop"
  >
    <section class="modal compact-modal">
      <button
        class="icon-button modal-close"
        @click="showCategoryModal = false"
      >
        <X />
      </button>
      <h2>Nueva categoría</h2>
      <p>Se agregará al catálogo y quedará seleccionada en este producto.</p>
      <p v-if="error" class="error">{{ error }}</p>
      <form novalidate @submit.prevent="saveQuickCategory">
        <label
          >Nombre<input
            v-model.trim="quickCategory.name"
            maxlength="100"
            autofocus
            placeholder="Ej. Bebidas" /></label
        ><label
          >Descripción <small>Opcional</small
          ><textarea
            v-model.trim="quickCategory.description"
            maxlength="500"
          /></label
        ><button class="primary full" :disabled="saving">
          <LoaderCircle v-if="saving" class="spin" :size="16" />{{
            saving ? "Guardando…" : "Crear y asignar"
          }}
        </button>
      </form>
    </section>
  </div>
  <div
    v-if="showAdjustment && adjusting"
    class="modal-backdrop"
  >
    <section class="modal">
      <button class="icon-button modal-close" @click="showAdjustment = false">
        <X />
      </button>
      <h2>Ajustar stock</h2>
      <p>
        {{ adjusting.name }} · stock actual:
        <strong>{{ adjusting.stock }}</strong>
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <form novalidate @submit.prevent="saveAdjustment">
        <label
          >Depósito<select v-model="adjustment.warehouseId">
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
        <div class="form-grid">
          <label
            >Movimiento<select v-model.number="adjustment.type">
              <option :value="3">Entrada / corrección positiva</option>
              <option :value="4">Salida / corrección negativa</option>
            </select></label
          ><label
            >Cantidad<input
              class="quantity-input"
              v-model.number="adjustment.quantity"
              type="number"
              min="1"
              step="1"
          /></label>
        </div>
        <label
          >Motivo<input
            v-model.trim="adjustment.reason"
            maxlength="300"
            placeholder="Ej. Recuento físico" /></label
        ><button class="primary full" :disabled="saving">
          {{ saving ? "Registrando…" : "Confirmar ajuste" }}
        </button>
      </form>
    </section>
  </div>
</template>
<style scoped>
.category-field {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}
.category-field select {
  min-width: 0;
  flex: 1;
}
.compact-modal {
  max-width: 30rem;
}
.product-modal {
  width: min(100%, 40rem);
  max-height: calc(100dvh - 24px);
  padding: 1.35rem 1.5rem;
}
.product-modal form {
  gap: 0.9rem;
  margin-top: 1rem;
}
.product-modal textarea {
  min-height: 5.25rem;
}
.product-modal .quantity-input {
  height: 3.25rem;
  padding: 0 0.95rem;
  line-height: 1.2;
}
.product-modal .input-hint-space {
  display: block;
  min-height: 1.2rem;
  margin-top: 0.35rem;
}
:deep(.invoice-actions) {
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.5rem;
}
:deep(.invoice-actions .inventory-tools) {
  display: flex;
  align-items: center;
  margin: 0;
}
</style>
