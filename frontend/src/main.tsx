import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
// Side-effect import: applies `data-theme` on <html> from the stored preference
// at module load. Routes that don't transitively import theme.ts (e.g. the
// standalone /dev/content dashboard) otherwise render in default dark.
import "./util/theme";
// Phase 18a: hydrate the Supabase auth store before React mounts so the
// initial render reads a stable `loading: true` → resolved state rather
// than flashing the login page to users with a persisted session.
import { initAuth } from "./auth/authStore";

initAuth();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
