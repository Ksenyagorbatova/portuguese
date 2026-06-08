import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { isLinkedWorktree, portOffset } from "./scripts/worktree.mjs";

// Project Pages site lives at https://ksenyagorbatova.github.io/portuguese/ so
// the production build (and `vite preview`) must prefix every asset with
// /portuguese/. In dev we serve from the root "/" so the Claude preview panel
// and a plain http://localhost:5173/ load the app directly (no subpath).
//
// In a linked git worktree we offset the dev port and disable strictPort so
// several worktrees can run `npm run dev` in parallel without colliding. The
// main checkout keeps the fixed 5173 (strict) — i.e. behaves exactly as before.
const worktree = isLinkedWorktree();
const port = worktree ? 5173 + portOffset() : 5173;

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/portuguese/" : "/",
  server: { port, strictPort: !worktree },
}));
