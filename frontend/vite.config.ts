import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { courseRegistryPlugin } from "./scripts/vitePluginCourseRegistry";

export default defineConfig({
  plugins: [react(), courseRegistryPlugin()],
  server: {
    port: 5173,
    // Phase 21C (post-audit): backend fetches the canonical course
    // catalog from this Vite dev server (server-side title lookup
    // for share creation). Inside docker compose the backend reaches
    // it via `http://frontend:5173/courses/...`, which Vite would
    // otherwise reject as an unknown Host header. Allowlist the
    // service hostname explicitly. `localhost` stays the default for
    // non-docker dev. Production serves /courses/* statically from
    // the SWA host — no Vite involved.
    allowedHosts: ["localhost", "frontend", "127.0.0.1"],
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
