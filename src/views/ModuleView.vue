<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Blocks } from "lucide-vue-next";
import { useTenantStore } from "../stores/tenant";
const route = useRoute(),
  tenant = useTenantStore();
const names: Record<string, string> = {
  ventas: "Ventas",
  facturacion: "Facturación ARCA",
  compras: "Compras",
  caja: "Caja",
  analytics: "Analytics",
  suscripcion: "Suscripción",
};
const title = computed(() => names[String(route.params.module)] || "Módulo");
const statuses: Record<number, string> = {
  1: "Activa",
  2: "Pago pendiente",
  3: "Cancelada",
  4: "Período de prueba",
};
</script>
<template>
  <div class="page-heading">
    <div>
      <div class="breadcrumb">Tu negocio / {{ title }}</div>
      <h1>{{ title }}</h1>
    </div>
  </div>
  <section v-if="route.params.module === 'suscripcion'" class="panel">
    <template v-if="tenant.subscription"
      ><span class="badge">{{
        statuses[tenant.subscription.status] || "Estado desconocido"
      }}</span>
      <h2 class="mt-4">Plan {{ tenant.subscription.planName }}</h2>
      <p>
        Vencimiento:
        {{
          new Date(tenant.subscription.expiresAtUtc).toLocaleDateString("es-AR")
        }}
      </p>
      <p>
        Renovación automática: {{ tenant.subscription.autoRenew ? "Sí" : "No" }}
      </p></template
    >
    <p v-else>La información de tu suscripción no está disponible.</p>
    <button class="text-button mt-4" @click="tenant.load">Actualizar</button>
  </section>
  <section v-else class="empty-state">
    <Blocks :size="40" /><span class="badge">PRÓXIMA ENTREGA</span>
    <h2>El espacio para {{ title.toLowerCase() }} está preparado</h2>
    <p>
      Las operaciones de este módulo se incorporarán en una próxima entrega.
    </p>
    <RouterLink to="/" class="primary">Volver al resumen</RouterLink>
  </section>
</template>
