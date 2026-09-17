<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Bell, Check } from "lucide-vue-next";
import TablePaginator from "../components/TablePaginator.vue";
import { api, apiError, notify } from "../services/api";
import { dateTime } from "../services/format";
import type { NotificationHistory, PagedResult } from "../types/api";

const result = ref<PagedResult<NotificationHistory> | null>(null), loading = ref(false), error = ref(""), page = ref(1);
const items = () => result.value?.items || [];
async function load() { loading.value = true; error.value = ""; try { result.value = (await api.get<PagedResult<NotificationHistory>>("/notifications/history", { params: { pageNumber: page.value, pageSize: 15 } })).data; } catch (cause) { error.value = apiError(cause); } finally { loading.value = false; } }
async function markRead(item: NotificationHistory) { try { await api.post(item.source === "platform" ? `/notifications/platform/${item.id}/read` : `/notifications/${item.id}/read`); item.isRead = true; notify("Notificación marcada como leída."); } catch (cause) { error.value = apiError(cause); } }
onMounted(load);
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Notificaciones</div><h1>Todas las notificaciones</h1><p>Consultá el historial de avisos de tu negocio y las respuestas de soporte.</p></div></div>
  <section class="panel notifications-history"><p v-if="error" class="error" role="alert">{{ error }}</p><p v-else-if="loading && !result" class="empty-small">Cargando notificaciones…</p><div v-else-if="items().length" class="responsive-table"><table><thead><tr><th>Notificación</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody><tr v-for="item in items()" :key="`${item.source}-${item.id}`"><td><strong>{{ item.title }}</strong><small>{{ item.message }}</small></td><td><span class="severity" :class="item.severity">{{ item.source === "platform" ? "Anuncio" : "Sistema" }}</span></td><td>{{ dateTime(item.createdAtUtc) }}</td><td><span class="status" :class="item.isRead ? 'muted-status' : 'warning'">{{ item.isRead ? "Leída" : "Nueva" }}</span></td><td><button v-if="!item.isRead" class="secondary compact" @click="markRead(item)"><Check :size="15" />Marcar leída</button></td></tr></tbody></table></div><div v-else class="empty-state compact"><Bell :size="34" /><h2>No tenés notificaciones</h2><p>Los anuncios y avisos de soporte aparecerán acá.</p></div><TablePaginator v-if="result" :page="result.pageNumber" :total-pages="result.totalPages" :total-count="result.totalCount" :shown-count="items().length" :page-size="result.pageSize" @previous="page -= 1; load()" @next="page += 1; load()" /></section>
</template>

<style scoped>
td small{display:block;margin-top:.25rem;color:#64748b}.severity{display:inline-flex;padding:.25rem .5rem;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:.72rem;font-weight:750}.severity.warning{background:#fef3c7;color:#92400e}.severity.success{background:#d1fae5;color:#047857}.compact{display:inline-flex;align-items:center;gap:.3rem;padding:.45rem .6rem;font-size:.75rem}.muted-status{background:#e2e8f0;color:#475569}.dark td small{color:#b8c7dc}.dark .muted-status{background:#334155;color:#d1dced}
</style>
