import { defineConfig, devices } from "@playwright/experimental-ct-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLinkedWorktree, portOffset } from "./scripts/worktree.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));

// CT serves on `ctPort`. In a linked worktree we offset it (or honor CT_PORT) so
// parallel CT runs across worktrees don't collide; the main checkout stays 3100.
const ctPort = Number(process.env.CT_PORT) || (isLinkedWorktree() ? 3100 + portOffset() : 3100);

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
  // On CI also write the HTML report (playwright-report/) — uploaded as an
  // artifact on failure together with test-results/ (see ci.yml, job test-ct).
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ctPort,
    // retries is 0, so "on-first-retry" would never record anything; keep
    // traces for failed runs on CI instead (they land in test-results/).
    trace: process.env.CI ? "retain-on-failure" : "off",
    ctViteConfig: {
      resolve: {
        alias: {
          // Components use Convex hooks; stub them so they mount in CT without a
          // live Convex client / auth provider (stubs in src/test/mocks).
          "@convex-dev/auth/react": path.resolve(dir, "src/test/mocks/convexAuthReact.ts"),
          "convex/react": path.resolve(dir, "src/test/mocks/convexReact.ts"),
        },
      },
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
