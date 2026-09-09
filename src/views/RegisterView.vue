<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Layers, ArrowRight } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { apiError } from "../services/api";
import {
  digitsOnly,
  isValidArgentineTaxId,
  isValidEmail,
  requiredText,
} from "../utils/validation";
const auth = useAuthStore(),
  router = useRouter();
const form = reactive({
  tenantName: "",
  taxId: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  taxCondition: "",
  businessCategory: "",
});
const busy = ref(false),
  error = ref("");
const fieldErrors = reactive<Record<string, string>>({});
function sanitizeTaxId() {
  form.taxId = digitsOnly(form.taxId, 11);
}
function validate() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  fieldErrors.firstName = requiredText(form.firstName, "El nombre", 100);
  fieldErrors.lastName = requiredText(form.lastName, "El apellido", 100);
  fieldErrors.tenantName = requiredText(
    form.tenantName,
    "El nombre del negocio",
    150,
  );
  fieldErrors.taxId = !form.taxId || isValidArgentineTaxId(form.taxId)
    ? ""
    : "Ingresá un CUIT argentino válido de 11 dígitos.";
  fieldErrors.email = isValidEmail(form.email)
    ? ""
    : "Ingresá un correo electrónico válido.";
  fieldErrors.password = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/.test(
    form.password,
  )
    ? ""
    : "La contraseña debe tener 12 caracteres, mayúscula, minúscula y número.";
  return !Object.values(fieldErrors).some(Boolean);
}
async function submit() {
  if (!validate()) return;
  busy.value = true;
  error.value = "";
  try {
    await auth.authenticate("register-tenant", form);
    await router.replace("/dashboard");
  } catch (e) {
    error.value = apiError(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="auth-page">
    <RouterLink to="/login" class="brand auth-brand"
      ><Layers :size="28" />SalesSaaS<span class="badge">ERP</span></RouterLink
    >
    <div class="auth-intro">
      <span class="eyebrow">EL PRÓXIMO PASO DE TU NEGOCIO</span>
      <h1>Empezá a gestionar mejor.</h1>
      <p>Creá tu cuenta y organizá tu operación desde hoy.</p>
    </div>
    <section class="auth-card register-card">
      <h2>Creá tu espacio de trabajo</h2>
      <p>Vos ponés la idea. Nosotros, el orden.</p>
      <form novalidate @submit.prevent="submit">
        <div class="form-grid">
          <label
            >Nombre<input
              v-model.trim="form.firstName"
              autocomplete="given-name"
              required
              maxlength="100"
              :aria-invalid="!!fieldErrors.firstName"
            /><small v-if="fieldErrors.firstName" class="field-error">{{
              fieldErrors.firstName
            }}</small></label
          ><label
            >Apellido<input
              v-model.trim="form.lastName"
              autocomplete="family-name"
              required
              maxlength="100"
              :aria-invalid="!!fieldErrors.lastName"
          /></label>
        </div>
        <label
          >Nombre del negocio<input
            v-model.trim="form.tenantName"
            autocomplete="organization"
            required
            maxlength="150"
            :aria-invalid="!!fieldErrors.tenantName"
            placeholder="Tu empresa" /></label
        ><label
          >CUIT / Identificación fiscal <small>Opcional por ahora</small><input
            v-model="form.taxId"
            maxlength="11"
            inputmode="numeric"
            pattern="[0-9]{11}"
            :aria-invalid="!!fieldErrors.taxId"
            placeholder="11 dígitos, sin guiones"
            @input="sanitizeTaxId"
          /><small v-if="fieldErrors.taxId" class="field-error">{{
            fieldErrors.taxId
          }}</small></label
        ><div class="form-grid"><label>Condición IVA <small>Opcional</small><select v-model="form.taxCondition"><option value="">Elegir después</option><option>Responsable Inscripto</option><option>Monotributista</option><option>Exento</option></select></label><label>Rubro <small>Opcional</small><select v-model="form.businessCategory"><option value="">Elegir después</option><option>Almacén y autoservicio</option><option>Indumentaria</option><option>Gastronomía</option><option>Servicios</option><option>Otro</option></select></label></div
        ><label
          >Correo electrónico<input
            v-model.trim="form.email"
            type="email"
            autocomplete="username"
            required
            maxlength="256"
            :aria-invalid="!!fieldErrors.email"
            placeholder="vos@tuempresa.com" /></label
        ><label
          >Contraseña<input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            required
            minlength="12"
            :aria-invalid="!!fieldErrors.password"
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,}"
            aria-describedby="password-hint"
        /></label>
        <p id="password-hint" class="hint">
          Al menos 12 caracteres, una mayúscula, una minúscula y un número.
        </p>
        <p
          v-if="
            fieldErrors.firstName ||
            fieldErrors.lastName ||
            fieldErrors.tenantName ||
            fieldErrors.email ||
            fieldErrors.password
          "
          class="error"
          role="alert"
        >
          {{
            fieldErrors.firstName ||
            fieldErrors.lastName ||
            fieldErrors.tenantName ||
            fieldErrors.email ||
            fieldErrors.password
          }}
        </p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary full" :disabled="busy">
          {{ busy ? "Creando tu negocio…" : "Crear mi negocio"
          }}<ArrowRight :size="18" />
        </button>
      </form>
      <p class="auth-footer">
        ¿Ya tenés cuenta? <RouterLink to="/login">Iniciá sesión</RouterLink>
      </p>
    </section>
  </main>
</template>
