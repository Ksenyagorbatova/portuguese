import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project Pages site lives at https://ksenyagorbatova.github.io/portuguese/ so
// the production build (and `vite preview`) must prefix every asset with
// /portuguese/. In dev we serve from the root "/" so the Claude preview panel
// and a plain http://localhost:5173/ load the app directly (no subpath).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/portuguese/" : "/",
}));
