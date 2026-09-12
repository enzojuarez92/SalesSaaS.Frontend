<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { LoaderCircle, UserRound } from "lucide-vue-next";
import { api, apiError } from "../services/api";
import { useAuthStore } from "../stores/auth";
const form = reactive({
  firstName: "",
  lastName: "",
  email: "",
  currentPassword: "",
  newPassword: "",
});
const loading = ref(false),
  error = ref("");
const auth = useAuthStore(),
  router = useRouter();
onMounted(async () => {
  try {
    Object.assign(form, (await api.get("/profile")).data);
  } catch (e) {
    error.value = apiError(e);
  }
});
async function save() {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    await api.put("/profile", {
      ...form,
      newPassword: form.newPassword || null,
    });
    auth.clear();
    await router.replace("/login");
  } catch (e) {
    error.value = apiError(e);
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1><UserRound /> Mi perfil</h1>
      <p>Actualizá tus datos y protegé el acceso a tu cuenta.</p>
    </div>
  </div>
  <section class="panel" style="max-width: 42rem">
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <form novalidate @submit.prevent="save">
      <div class="form-grid">
        <label
          >Nombre<input
            v-model.trim="form.firstName"
            required
            maxlength="100" /></label
        ><label
          >Apellido<input v-model.trim="form.lastName" required maxlength="100"
        /></label>
      </div>
      <label
        >Email<input
          v-model.trim="form.email"
          type="email"
          required
          maxlength="254" /></label
      ><label
        >Contraseña actual<input
          v-model="form.currentPassword"
          type="password"
          required
          autocomplete="current-password" /></label
      ><label
        >Nueva contraseña (opcional)<input
          v-model="form.newPassword"
          type="password"
          minlength="12"
          maxlength="128"
          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+"
          autocomplete="new-password"
        /><small>12 caracteres, mayúscula, minúscula y número.</small></label
      >
      <p>
        Al guardar, se cerrarán tus sesiones y podrás ingresar con tus datos
        actualizados.
      </p>
      <button class="primary" :disabled="loading">
        <LoaderCircle v-if="loading" class="spin" />Guardar cambios
      </button>
    </form>
  </section>
</template>
