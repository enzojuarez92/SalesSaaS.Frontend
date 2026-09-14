<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

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
function formatWhileEditing(value: number, source: string) {
  if (!source) return String(Math.trunc(value));
  // Mientras el usuario escribe, un punto puede ser el agrupador de miles
  // que el propio componente mostró antes. No se debe reinterpretar como
  // decimal: los decimales se escriben con coma según el formato local.
  const normalized = source.replace(/[^\d,]/g, "");
  const [integerPart = "", ...decimalParts] = normalized.split(",");
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  if (!decimalParts.length) return integer;
  return `${integer},${decimalParts.join("").slice(0, 2)}`;
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
async function focus(event: FocusEvent) {
  editing.value = true;
  display.value = formatWhileEditing(Number(props.modelValue ?? props.min), "");
  await nextTick();
  (event.target as HTMLInputElement).select();
}
async function input(event: Event) {
  const input = event.target as HTMLInputElement;
  const raw = input.value;
  const cursor = input.selectionStart ?? raw.length;
  const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
  const value = parse(raw);
  emit("update:modelValue", value);
  display.value = formatWhileEditing(value, raw);
  await nextTick();
  let seenDigits = 0;
  let nextCursor = display.value.length;
  for (let index = 0; index < display.value.length; index += 1) {
    if (/\d/.test(display.value[index])) seenDigits += 1;
    if (seenDigits >= digitsBeforeCursor) {
      nextCursor = index + 1;
      break;
    }
  }
  input.setSelectionRange(nextCursor, nextCursor);
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
