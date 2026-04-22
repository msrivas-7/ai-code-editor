import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // P-H2: force Monaco + its workers into a dedicated chunk so it can
        // stay dynamically-imported by lazy(() => import("./MonacoPane")) and
        // doesn't bleed back into the landing/entry bundle via accidental
        // dependency sharing. `react-router-dom` lives in the SPA shell (every
        // route touches it), so it gets its own stable chunk — without this,
        // the router's ~40 KB bounces between chunks across builds.
        manualChunks: {
          monaco: ["monaco-editor", "@monaco-editor/react"],
          router: ["react-router-dom"],
        },
      },
    },
  },
});
