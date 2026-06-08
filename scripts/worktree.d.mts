// Type declarations for worktree.mjs so the TS config files (vite.config.ts,
// playwright-ct.config.ts) can import it under `tsc -b` without allowJs.
export function isLinkedWorktree(): boolean;
export function portOffset(): number;
