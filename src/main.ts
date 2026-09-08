import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { useAuthStore } from "./stores/auth";
import { useTenantStore } from "./stores/tenant";
import { SESSION_KEY } from "./services/session";
import "./style.css";
const app = createApp(App);
app.use(createPinia());
app.use(router);
function expire() {
  useAuthStore().clear();
  useTenantStore().reset();
  void router.replace({ path: "/login", query: { expired: "1" } });
}
window.addEventListener("auth:expired", expire);
window.addEventListener("storage", (event) => {
  if (event.key === SESSION_KEY) {
    useTenantStore().reset();
    window.location.reload();
  }
});
setInterval(() => {
  const auth = useAuthStore();
  if (auth.session && !auth.isAuthenticated) expire();
}, 15000);
app.mount("#app");
