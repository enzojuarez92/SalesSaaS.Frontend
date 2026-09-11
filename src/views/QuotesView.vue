<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, apiError } from "../services/api";
import { money, dateTime } from "../services/format";
const rows = ref<
    Array<{
      id: string;
      customer: string;
      totalAmount: number;
      expiresAtUtc: string;
      status: string;
    }>
  >([]),
  loading = ref(false),
  error = ref("");
onMounted(async () => {
  loading.value = true;
  try {
    rows.value = (await api.get("/sales/quotes")).data;
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>Presupuestos</h1>
      <p>
        Propuestas comerciales del negocio. No reservan stock ni representan una
        venta.
      </p>
    </div>
    <RouterLink class="primary" to="/ventas"
      >Preparar presupuesto en POS</RouterLink
    >
  </div>
  <section class="panel">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" role="status">Cargando presupuestos…</p>
    <div class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Total cotizado</th>
            <th>Vencimiento</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in rows" :key="q.id">
            <td>{{ q.customer }}</td>
            <td>{{ money(q.totalAmount) }}</td>
            <td>{{ dateTime(q.expiresAtUtc) }}</td>
            <td>
              {{
                new Date(q.expiresAtUtc).getTime() < Date.now()
                  ? "Vencido"
                  : "Vigente"
              }}
            </td>
          </tr>
          <tr v-if="!loading && !rows.length">
            <td colspan="4">
              Todavía no hay presupuestos. Prepará uno desde el POS.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
