<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { CheckCircle2, CircleAlert, X } from "lucide-vue-next";
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
      <CircleAlert v-if="m.error" /><CheckCircle2 v-else /><span>{{
        m.text
      }}</span
      ><button
        class="icon-button"
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
  display: flex;
  gap: 0.6rem;
  align-items: center;
  padding: 0.85rem;
  border-radius: 1rem;
  box-shadow: 0 8px 24px #0f172a22;
  border: 1px solid;
}
.toast span {
  flex: 1;
}
.toast svg {
  flex-shrink: 0;
}
.toast-error {
  background: #fff1f2;
  color: #9f1239;
  border-color: #fecdd3;
}
.toast-success {
  background: #ecfdf5;
  color: #065f46;
  border-color: #a7f3d0;
}
</style>
