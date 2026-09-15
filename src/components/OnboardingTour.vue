<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ArrowLeft, ArrowRight, CircleHelp, Rocket, X } from "lucide-vue-next";

const emit = defineEmits<{ (event: "complete"): void; (event: "skip"): void }>();
const current = ref(0);
const steps = [
  { title: "Conocé la navegación principal", description: "Desde este menú podés entrar rápidamente a Ventas / POS, Productos, Caja y Reportes. Cada sección conserva el depósito activo que elegiste arriba.", target: '[data-tour="main-navigation"]' },
  { title: "Configurá tu empresa y ARCA", description: "En Configuración cargás los datos de tu negocio, CUIT y certificado. Ahí también vas a encontrar una guía para vincular ARCA antes de emitir comprobantes.", target: '[data-tour="company-setup"]' },
  { title: "Abrí caja y empezá a cobrar", description: "Abrí el turno desde Caja y luego ingresá a Ventas / POS para registrar cobros. Las ventas en efectivo se reflejan automáticamente en la caja activa.", target: '[data-tour="cash-pos"]' },
];
const step = computed(() => steps[current.value]);
let highlighted: HTMLElement | null = null;
async function highlightTarget() {
  highlighted?.classList.remove("tour-target-active"); highlighted = null;
  await nextTick();
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(step.value.target);
    if (!target) return;
    highlighted = target; target.classList.add("tour-target-active");
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  });
}
function previous() { if (current.value > 0) current.value -= 1; }
function next() { if (current.value < steps.length - 1) current.value += 1; else finish("complete"); }
function finish(event: "complete" | "skip") {
  highlighted?.classList.remove("tour-target-active");
  if (event === "complete") emit("complete");
  else emit("skip");
}
watch(current, highlightTarget, { immediate: true });
onBeforeUnmount(() => highlighted?.classList.remove("tour-target-active"));
</script>

<template>
  <div class="onboarding-overlay" aria-live="polite">
    <section class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-tour-title">
      <button class="onboarding-close" aria-label="Saltar tour" @click="finish('skip')"><X :size="18" /></button>
      <div class="onboarding-icon"><Rocket :size="22" /></div>
      <p class="onboarding-progress">PASO {{ current + 1 }} DE {{ steps.length }}</p>
      <h2 id="onboarding-tour-title">{{ step.title }}</h2>
      <p>{{ step.description }}</p>
      <div class="onboarding-actions">
        <button class="onboarding-skip" @click="finish('skip')"><CircleHelp :size="16" /> Saltar tour</button>
        <div class="onboarding-next-actions">
          <button v-if="current > 0" class="secondary" @click="previous"><ArrowLeft :size="16" /> Anterior</button>
          <button class="primary" @click="next">{{ current === steps.length - 1 ? "Finalizar" : "Siguiente" }}<ArrowRight v-if="current < steps.length - 1" :size="16" /></button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.onboarding-overlay{position:fixed;inset:0;z-index:2000;background:#0f172a66;pointer-events:none}.onboarding-card{position:absolute;right:2rem;bottom:2rem;width:min(28rem,calc(100vw - 2rem));padding:1.35rem;border:1px solid #fbcfe8;border-radius:1rem;background:#fff;box-shadow:0 22px 60px #0f172a4d;pointer-events:auto}.onboarding-close{position:absolute;top:.7rem;right:.7rem;display:grid;place-items:center;width:2rem;height:2rem;border:0;border-radius:.5rem;background:transparent;color:#64748b;cursor:pointer}.onboarding-close:hover{background:#f8fafc}.onboarding-icon{display:grid;place-items:center;width:2.65rem;height:2.65rem;margin-bottom:.8rem;border-radius:.75rem;background:#fdf2f8;color:#ec4899}.onboarding-progress{margin:0;color:#db2777;font-size:.68rem;font-weight:800;letter-spacing:.11em}.onboarding-card h2{margin:.35rem 0 .55rem;font-size:1.22rem}.onboarding-card>p:not(.onboarding-progress){margin:0;color:#475569;line-height:1.55}.onboarding-actions{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-top:1.2rem}.onboarding-next-actions{display:flex;gap:.55rem}.onboarding-actions .primary,.onboarding-actions .secondary{display:inline-flex;align-items:center;gap:.35rem;padding:.62rem .8rem;font-size:.8rem}.onboarding-skip{display:inline-flex;align-items:center;gap:.35rem;border:0;background:transparent;color:#64748b;font-size:.8rem;font-weight:650;cursor:pointer}.onboarding-skip:hover{color:#db2777}:global(.tour-target-active){outline:3px solid #f472b6;outline-offset:4px;border-radius:.65rem;transition:outline-color .2s ease}:global(.dark) .onboarding-card{border-color:#7c2d5b;background:#18233a;color:#f8fafc}:global(.dark) .onboarding-card>p:not(.onboarding-progress){color:#cbd5e1}:global(.dark) .onboarding-close{color:#cbd5e1}:global(.dark) .onboarding-close:hover{background:#263653}:global(.dark) .onboarding-skip{color:#b8c7dc}@media(max-width:700px){.onboarding-card{right:1rem;bottom:1rem}.onboarding-actions{align-items:flex-start;flex-direction:column}.onboarding-next-actions{width:100%;justify-content:flex-end}}
</style>
