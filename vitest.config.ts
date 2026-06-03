import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Two Vitest projects with different runtimes:
//   • backend  — Convex functions via convex-test, in the edge-runtime VM
//                (mirrors the Convex server runtime). Tests live in convex/.
//   • frontend — pure client logic + React units in jsdom. Tests live in src/.
// Playwright Component Testing is a SEPARATE runner (playwright-ct.config.ts),
// not part of this Vitest config.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "backend",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
