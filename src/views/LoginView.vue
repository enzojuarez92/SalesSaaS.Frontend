<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, Layers, Eye, EyeOff } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { apiError } from "../services/api";
import { safeRedirect } from "../router";
import { isValidEmail } from "../utils/validation";
const auth = useAuthStore(),
  route = useRoute(),
  router = useRouter();
const email = ref(""),
  password = ref(""),
  tenantId = ref(""),
  error = ref(""),
  busy = ref(false),
  visible = ref(false);
const fieldErrors = ref<{ email?: string; password?: string }>({});
async function submit() {
  if (!isValidEmail(email.value)) {
    fieldErrors.value = { email: "Ingresá un correo electrónico válido." };
    return;
  }
  if (!password.value) {
    fieldErrors.value = { password: "La contraseña es obligatoria." };
    return;
  }
  fieldErrors.value = {};
  busy.value = true;
  error.value = "";
  try {
    await auth.authenticate("login", {
      email: email.value,
      password: password.value,
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
    });
    await router.replace(safeRedirect(route.query.redirect));
  } catch (e) {
    error.value = apiError(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="auth-page">
    <a class="brand auth-brand" href="/login"
      ><Layers :size="28" /> SalesSaaS<span class="badge">ERP</span></a
    >
    <div class="auth-intro">
      <span class="eyebrow">MENOS TAREAS. MÁS POSIBILIDADES.</span>
      <h1>Tu negocio, en un solo lugar.</h1>
      <p>Conectá tu operación. Tomá mejores decisiones.</p>
    </div>
    <section class="auth-card">
      <div class="icon-tile"><Layers /></div>
      <h2>
        {{
          route.query.switch ? "Cambiar de negocio" : "Qué bueno verte de nuevo"
        }}
      </h2>
      <p>Ingresá a tu espacio de trabajo.</p>
      <p v-if="route.query.expired" class="notice" role="status">
        Tu sesión venció. Volvé a ingresar.
      </p>
      <form novalidate @submit.prevent="submit">
        <label
          >Correo electrónico<input
            v-model="email"
            type="email"
            autocomplete="username"
            required
            maxlength="256"
            :aria-invalid="!!fieldErrors.email"
            @input="fieldErrors.email = undefined"
            placeholder="vos@tuempresa.com"
        /><small v-if="fieldErrors.email" class="field-error" role="alert">{{ fieldErrors.email }}</small></label>
        <label
          >Contraseña<span class="password-field"
            ><input
              v-model="password"
              :type="visible ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :aria-invalid="!!fieldErrors.password"
              @input="fieldErrors.password = undefined"
              placeholder="Ingresá tu contraseña" /><button
              type="button"
              class="icon-button"
              :aria-label="
                visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
              "
              @click="visible = !visible"
            >
              <EyeOff v-if="visible" :size="18" /><Eye
                v-else
                :size="18"
              /></button></span
        ><small v-if="fieldErrors.password" class="field-error" role="alert">{{ fieldErrors.password }}</small></label>
        <details :open="!!route.query.switch">
          <summary>Elegir otro negocio</summary>
          <label class="mt-3"
            >ID del negocio<input
              v-model="tenantId"
              placeholder="Identificador del tenant"
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          /></label>
          <p class="hint">
            Opcional. Si lo dejás vacío, ingresás a tu primer negocio activo.
          </p>
        </details>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary full" :disabled="busy">
          {{ busy ? "Ingresando…" : "Ingresar a mi negocio"
          }}<ArrowRight :size="18" />
        </button>
      </form>
      <p class="auth-footer">
        ¿Todavía no tenés cuenta?
        <RouterLink to="/register">Creá tu negocio</RouterLink>
      </p>
    </section>
    <p class="auth-bottom">
      Un espacio para cada negocio. Todo bajo tu control.
    </p>
  </main>
</template>
