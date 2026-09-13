<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  page: number;
  totalPages: number;
  totalCount: number;
  shownCount: number;
  pageSize: number;
}>();
defineEmits<{ previous: []; next: [] }>();

const summary = computed(() => {
  if (!props.totalCount) return "Mostrando 0 de 0 registros";
  const from = (props.page - 1) * props.pageSize + 1;
  const to = Math.min(from + props.shownCount - 1, props.totalCount);
  return `Mostrando ${from}-${to} de ${props.totalCount} registros`;
});
</script>

<template>
  <footer class="pagination table-pagination">
    <span class="pagination-summary">{{ summary }}</span>
    <div class="pagination-controls">
      <button class="secondary" :disabled="page <= 1" @click="$emit('previous')">Anterior</button>
      <span>Página {{ page }} de {{ totalPages }}</span>
      <button class="secondary" :disabled="page >= totalPages" @click="$emit('next')">Siguiente</button>
    </div>
  </footer>
</template>
