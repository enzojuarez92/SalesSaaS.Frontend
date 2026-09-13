<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { CheckCircle2, CircleX, X } from "lucide-vue-next";
const messages = ref<Array<{ id: number; text: string; error: boolean }>>([]);
let seq = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();
function receive(event: Event) {
  const detail = (event as CustomEvent).detail;
  const id = ++seq;
  messages.value = [
    ...messages.value.slice(-3),
    { id, text: detail.message, error: detail.error },
  ];
  const timer = setTimeout(() => {
    messages.value = messages.value.filter((m) => m.id !== id);
    timers.delete(timer);
  }, 4000);
  timers.add(timer);
}
onMounted(() => window.addEventListener("app:toast", receive));
onUnmounted(() => {
  window.removeEventListener("app:toast", receive);
  timers.forEach(clearTimeout);
});
</script>
<template>
  <div class="toast-region" aria-live="polite">
    <div
      v-for="m in messages"
      :key="m.id"
      class="toast"
      :class="m.error ? 'toast-error' : 'toast-success'"
      :role="m.error ? 'alert' : 'status'"
    >
      <span class="toast-icon">
        <CircleX v-if="m.error" :size="24" />
        <CheckCircle2 v-else :size="24" />
      </span>
      <span class="toast-content">
        <strong>{{ m.error ? "No se pudo completar la acción" : "Operación completada" }}</strong>
        <span>{{ m.text }}</span>
      </span>
      <button
        class="toast-close"
        aria-label="Cerrar notificación"
        @click="messages = messages.filter((x) => x.id !== m.id)"
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>
<style scoped>
.toast-region {
  position: fixed;
  right: 1rem;
  top: 1rem;
  z-index: 9999;
  display: grid;
  gap: 0.5rem;
  width: min(28rem, calc(100vw - 2rem));
}
.toast {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.9rem;
  align-items: center;
  padding: 1rem 1.1rem;
  border-radius: 0.85rem;
  color: #d8d4e8;
  background: #252041;
  border: 1px solid #ffffff0d;
  box-shadow: 0 16px 35px #08051e66;
  overflow: hidden;
}
.toast-content {
  display: grid;
  gap: 0.2rem;
  flex: 1;
}
.toast-content strong {
  font-size: 0.98rem;
  line-height: 1.2;
}
.toast-content > span {
  color: #c3bdd6;
  font-size: 0.9rem;
  line-height: 1.3;
}
.toast-icon {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  flex-shrink: 0;
}
.toast-close {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 0.4rem;
  color: #b7b0ce;
  background: transparent;
  cursor: pointer;
}
.toast-close:hover { background: #ffffff14; color: #fff; }
.toast-error {
  background: linear-gradient(100deg, #492240, #252041 72%);
}
.toast-error .toast-icon,
.toast-error .toast-content strong { color: #ff3269; }
.toast-success {
  background: linear-gradient(100deg, #124d4b, #252041 72%);
}
.toast-success .toast-icon,
.toast-success .toast-content strong { color: #22e382; }
</style>
