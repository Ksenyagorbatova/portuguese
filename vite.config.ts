import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project Pages site lives at https://ksenyagorbatova.github.io/portuguese/
// so every asset URL must be prefixed with /portuguese/.
export default defineConfig({
  plugins: [react()],
  base: "/portuguese/",
});
