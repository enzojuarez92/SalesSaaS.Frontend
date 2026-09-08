import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [vue(), tailwindcss()],
    server: {
      watch: {
        // Visual Studio maintains a locked search-index under .vs on Windows.
        ignored: ["**/.vs/**"],
      },
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:5274",
          changeOrigin: true,
        },
      },
    },
  };
});
