<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{ modelValue: number; min?: number; currency?: boolean }>(),
  { min: 0, currency: true },
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();
const editing = ref(false);
const display = ref("");

function format(value: number) {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return props.currency ? `$ ${formatted}` : formatted;
}
function parse(value: string) {
  const text = value.replace(/[^\d,.-]/g, "").replace(/-/g, "");
  if (!text) return props.min;
  const commaIndex = text.lastIndexOf(",");
  let normalized: string;
  if (commaIndex >= 0) {
    normalized = `${text.slice(0, commaIndex).replace(/[.]/g, "")}.${text.slice(commaIndex + 1)}`;
  } else {
    const dotParts = text.split(".");
    normalized =
      dotParts.length > 1 && dotParts.at(-1)!.length <= 2
        ? `${dotParts.slice(0, -1).join("")}.${dotParts.at(-1)}`
        : text.replace(/[.]/g, "");
  }
  const result = Number(normalized);
  return Number.isFinite(result) ? Math.max(props.min, result) : props.min;
}
function focus() {
  editing.value = true;
  display.value = String(props.modelValue ?? props.min);
}
function input(event: Event) {
  display.value = (event.target as HTMLInputElement).value;
  emit("update:modelValue", parse(display.value));
}
function blur() {
  editing.value = false;
  const value = parse(display.value);
  emit("update:modelValue", value);
  display.value = format(value);
}
watch(
  () => props.modelValue,
  (value) => {
    if (!editing.value) display.value = format(Number(value ?? props.min));
  },
  { immediate: true },
);
</script>
<template>
  <input
    v-bind="$attrs"
    class="currency-input"
    :value="display"
    type="text"
    inputmode="decimal"
    @focus="focus"
    @input="input"
    @blur="blur"
  />
</template>
