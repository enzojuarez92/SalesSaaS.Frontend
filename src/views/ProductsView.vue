<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Search,
  X,
} from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
import type { PagedResult, Product } from "../types/api";
import { nonNegative, requiredText } from "../utils/validation";
const auth = useAuthStore();
const products = ref<Product[]>([]),
  page = ref(1),
  totalPages = ref(1),
  totalCount = ref(0),
  search = ref(""),
  loading = ref(false),
  saving = ref(false),
  error = ref(""),
  showModal = ref(false),
  editingId = ref<string | null>(null);
const fieldErrors = reactive<Record<string, string>>({});
const form = reactive({
  sku: "",
  name: "",
  description: "",
  price: 0,
  cost: 0,
  stock: 0,
  minimumStockAlert: 0,
});
const money = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    value,
  );
const canManage = computed(() =>
  ["Owner", "Admin", "Warehouse"].includes(auth.user?.role || ""),
);
async function load() {
  if (!auth.tenantId) return;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<PagedResult<Product>>("/products", {
      params: {
        tenantId: auth.tenantId,
        searchTerm: search.value || undefined,
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
          stock: product.stock,
          minimumStockAlert: product.minimumStockAlert,
        }
      : {
          sku: "",
          name: "",
          description: "",
          price: 0,
          cost: 0,
          stock: 0,
          minimumStockAlert: 0,
        },
  );
  showModal.value = true;
  error.value = "";
}
async function save() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  fieldErrors.sku = requiredText(form.sku, "El SKU", 50);
  fieldErrors.name = requiredText(form.name, "El nombre del producto", 150);
  fieldErrors.price = nonNegative(form.price, "El precio");
  fieldErrors.cost = nonNegative(form.cost, "El costo");
  fieldErrors.stock = nonNegative(form.stock, "El stock");
  fieldErrors.minimumStockAlert = nonNegative(
    form.minimumStockAlert,
    "La alerta mínima",
  );
  if (Object.values(fieldErrors).some(Boolean)) {
    error.value = Object.values(fieldErrors).find(Boolean) || "";
    return;
  }
  saving.value = true;
  error.value = "";
  const payload = {
    tenantId: auth.tenantId,
    ...form,
    categoryId: null,
    brandId: null,
  };
  try {
    if (editingId.value)
      await api.put(`/products/${editingId.value}`, {
        id: editingId.value,
        ...payload,
      });
    else await api.post("/products", payload);
    showModal.value = false;
    await load();
  } catch (cause) {
    error.value = apiError(cause);
  } finally {
    saving.value = false;
  }
}
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
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
  },
  { immediate: true },
);
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / Inventario</div>
      <h1>Productos e inventario</h1>
      <p>Controlá el catálogo y detectá faltantes antes de perder una venta.</p>
    </div>
    <button v-if="canManage" class="primary" @click="open()">
      <PackagePlus :size="17" />Nuevo producto
    </button>
  </div>
  <p v-if="error && !showModal" class="error" role="alert">{{ error }}</p>
  <section class="panel inventory-panel">
    <div class="inventory-toolbar">
      <label class="search-input"
        ><Search :size="17" /><input
          v-model="search"
          placeholder="Buscar por SKU o nombre"
          aria-label="Buscar productos" /></label
      ><span>{{ totalCount }} producto(s) activo(s)</span>
    </div>
    <div v-if="loading" class="empty-small">
      <LoaderCircle class="spin" /> Actualizando inventario…
    </div>
    <div v-else class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th v-if="canManage"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td data-label="Producto">
              <strong>{{ product.name }}</strong
              ><small>{{ product.sku }}</small>
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
              <span
                v-if="product.stock <= product.minimumStockAlert"
                class="status danger"
                ><AlertTriangle :size="13" />Stock bajo</span
              ><span v-else class="status success-status">Disponible</span>
            </td>
            <td v-if="canManage" data-label="Acciones">
              <button
                class="icon-button"
                :aria-label="`Editar ${product.name}`"
                @click="open(product)"
              >
                <Pencil :size="17" />
              </button>
            </td>
          </tr>
          <tr v-if="!products.length">
            <td :colspan="canManage ? 5 : 4">
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
        aria-label="Página anterior"
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
        aria-label="Página siguiente"
        @click="
          page++;
          load();
        "
      >
        <ChevronRight />
      </button>
    </div>
  </section>
  <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
    <section
      class="modal product-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-title"
    >
      <button
        class="icon-button modal-close"
        aria-label="Cerrar"
        @click="showModal = false"
      >
        <X />
      </button>
      <h2 id="product-title">
        {{ editingId ? "Editar producto" : "Nuevo producto" }}
      </h2>
      <p>Los cambios se guardan directamente en el inventario del negocio.</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <form @submit.prevent="save">
        <div class="form-grid">
          <label
            >SKU<input v-model.trim="form.sku" required maxlength="50" /></label
          ><label
            >Nombre<input v-model.trim="form.name" required maxlength="150"
          /></label>
        </div>
        <label
          >Descripción<textarea
            v-model="form.description"
            maxlength="1000"
          ></textarea>
        </label>
        <div class="form-grid">
          <label
            >Precio de venta<input
              v-model.number="form.price"
              type="number"
              min="0"
              step="0.01"
              required /></label
          ><label
            >Costo<input
              v-model.number="form.cost"
              type="number"
              min="0"
              step="0.01"
              required /></label
          ><label
            >Stock actual<input
              v-model.number="form.stock"
              type="number"
              min="0"
              step="1"
              required /></label
          ><label
            >Alerta mínima<input
              v-model.number="form.minimumStockAlert"
              type="number"
              min="0"
              step="1"
              required
          /></label>
        </div>
        <button class="primary full" :disabled="saving">
          <LoaderCircle v-if="saving" class="spin" :size="16" />{{
            saving ? "Guardando…" : "Guardar producto"
          }}
        </button>
      </form>
    </section>
  </div>
</template>
