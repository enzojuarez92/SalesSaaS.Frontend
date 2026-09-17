<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { LifeBuoy, LoaderCircle, Plus, Send } from "lucide-vue-next";
import { api, apiError, notify } from "../services/api";
import { dateTime } from "../services/format";
import type { SupportTicket } from "../types/api";

const tickets = ref<SupportTicket[]>([]), loading = ref(false), sending = ref(false), error = ref("");
const form = reactive({ subject: "", message: "" });
const statusLabel = (status: number) => ({ 1: "Abierto", 2: "En progreso", 3: "Resuelto" }[status] || "Abierto");
const statusClass = (status: number) => ({ 1: "warning", 2: "trial", 3: "success-status" }[status] || "warning");
const hasOpenTickets = computed(() => tickets.value.some(ticket => ticket.status !== 3));
async function load() { loading.value = true; error.value = ""; try { tickets.value = (await api.get<SupportTicket[]>("/support")).data; } catch (cause) { error.value = apiError(cause); } finally { loading.value = false; } }
async function submit() { if (!form.subject.trim() || !form.message.trim()) { error.value = "Completá el asunto y el mensaje de tu consulta."; return; } sending.value = true; error.value = ""; try { const { data } = await api.post<SupportTicket>("/support", form); tickets.value = [data, ...tickets.value]; form.subject = ""; form.message = ""; notify("Tu consulta fue enviada al equipo de soporte."); } catch (cause) { error.value = apiError(cause); } finally { sending.value = false; } }
onMounted(load);
</script>

<template>
  <div class="page-heading"><div><div class="breadcrumb">Tu negocio / Soporte</div><h1>Soporte y ayuda</h1><p>Enviá una consulta al equipo de SalesSaaS y seguí sus respuestas.</p></div></div>
  <section class="support-grid"><form class="panel support-form" novalidate @submit.prevent="submit"><div class="support-icon"><LifeBuoy :size="23" /></div><h2>¿En qué podemos ayudarte?</h2><p>Describí tu consulta y te responderemos por este mismo canal.</p><label>Asunto<input v-model.trim="form.subject" maxlength="200" placeholder="Ej. No puedo emitir un comprobante" /></label><label>Mensaje<textarea v-model.trim="form.message" maxlength="4000" rows="6" placeholder="Contanos qué ocurrió y qué estabas intentando hacer." /></label><p v-if="error" class="error" role="alert">{{ error }}</p><button class="primary full" :disabled="sending"><LoaderCircle v-if="sending" class="spin" :size="16" /><Send v-else :size="16" />{{ sending ? "Enviando…" : "Enviar consulta" }}</button></form>
    <section class="panel support-history"><div class="section-heading"><div><h2>Historial de consultas</h2><p class="muted">{{ hasOpenTickets ? "Tenés consultas pendientes de respuesta." : "No tenés consultas pendientes." }}</p></div><button class="icon-button" title="Actualizar" @click="load"><Plus :size="17" /></button></div><p v-if="loading" class="empty-small">Cargando consultas…</p><div v-else-if="!tickets.length" class="empty-state compact"><LifeBuoy :size="34" /><h2>Todavía no enviaste consultas</h2><p>Cuando necesites ayuda, escribinos desde el formulario.</p></div><article v-for="ticket in tickets" :key="ticket.id" class="support-ticket"><div class="ticket-head"><div><strong>{{ ticket.subject }}</strong><small>{{ dateTime(ticket.createdAtUtc) }}</small></div><span class="status" :class="statusClass(ticket.status)">{{ statusLabel(ticket.status) }}</span></div><p>{{ ticket.message }}</p><div v-if="ticket.response" class="support-response"><strong>Respuesta de soporte</strong><p>{{ ticket.response }}</p><small>{{ dateTime(ticket.updatedAtUtc) }}</small></div></article></section>
  </section>
</template>

<style scoped>
.support-grid{display:grid;grid-template-columns:minmax(18rem,.85fr) minmax(0,1.4fr);gap:1rem}.support-form{align-self:start}.support-icon{display:grid;place-items:center;width:2.7rem;height:2.7rem;border-radius:.75rem;background:#fdf2f8;color:#ec4899}.support-form h2{margin:.75rem 0 .25rem}.support-form>p{margin:0 0 1rem;color:#64748b}.support-history{min-height:24rem}.support-ticket{padding:1rem 0;border-top:1px solid #e2e8f0}.ticket-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.ticket-head strong,.ticket-head small{display:block}.ticket-head small,.support-response small{margin-top:.25rem;color:#64748b;font-size:.75rem}.support-ticket>p{margin:.65rem 0;color:#475569}.support-response{padding:.75rem;border-radius:.65rem;background:#ecfdf5;color:#065f46}.support-response p{margin:.3rem 0}.trial{background:#ede9fe;color:#6d28d9}.warning{background:#fef3c7;color:#92400e}.dark .support-ticket{border-color:#334155}.dark .support-form>p,.dark .ticket-head small{color:#b8c7dc}.dark .support-ticket>p{color:#d1dced}.dark .support-response{background:#173a35;color:#a7f3d0}@media(max-width:850px){.support-grid{grid-template-columns:1fr}}
</style>
