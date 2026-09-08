import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { api, apiError } from "../services/api";
import type { Warehouse, Subscription } from "../types/api";
export const useTenantStore = defineStore("tenant", () => {
  const auth = useAuthStore();
  const activeTenantId = computed(() => auth.tenantId);
  const warehouses = ref<Warehouse[]>([]);
  const activeWarehouseId = ref("");
  const subscription = ref<Subscription | null>(null);
  const error = ref("");
  let generation = 0;
  function reset() {
    generation++;
    warehouses.value = [];
    activeWarehouseId.value = "";
    subscription.value = null;
    error.value = "";
  }
  async function load() {
    reset();
    const current = generation;
    if (!activeTenantId.value) return;
    const params = { tenantId: activeTenantId.value };
    const results = await Promise.allSettled([
      api.get<Subscription | null>("/billing/subscriptions/current", {
        params,
      }),
      api.get<Warehouse[]>("/warehouses", { params }),
    ]);
    if (current !== generation) return;
    const [billing, locations] = results;
    if (billing.status === "fulfilled") subscription.value = billing.value.data;
    else error.value = apiError(billing.reason);
    if (locations.status === "fulfilled")
      warehouses.value = locations.value.data.filter((w) => w.isActive);
    else error.value = apiError(locations.reason);
    if (!activeWarehouseId.value && warehouses.value.length === 1)
      activeWarehouseId.value = warehouses.value[0].id;
  }
  return {
    activeTenantId,
    warehouses,
    activeWarehouseId,
    subscription,
    error,
    load,
    reset,
  };
});
