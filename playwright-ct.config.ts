import { defineConfig, devices } from "@playwright/experimental-ct-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Playwright Component Testing for React (Vite under the hood). Separate from
// Vitest: this mounts real components in a real Chromium. Components that pull
// Convex hooks are isolated by aliasing those modules to lightweight test stubs
// (see src/test/mocks). Tests are *.ct.tsx next to the components.
export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.ct.tsx",
  snapshotDir: "./__snapshots__",
  timeout: 10_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
    ctViteConfig: {
      resolve: {
        alias: {
          // SignIn uses useAuthActions(); stub it so the component mounts
          // without a live Convex/auth provider.
          "@convex-dev/auth/react": path.resolve(dir, "src/test/mocks/convexAuthReact.ts"),
        },
      },
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
