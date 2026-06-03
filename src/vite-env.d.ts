/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Convex deployment URL. Injected at build time (dev: .env.local, prod: CI). */
  readonly VITE_CONVEX_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
