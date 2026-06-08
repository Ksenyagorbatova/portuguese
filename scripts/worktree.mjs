import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
}

/**
 * True when the current working directory is a *linked* git worktree
 * (created via `git worktree add`), false in the main checkout.
 *
 * A linked worktree's git-dir points at `.git/worktrees/<name>` while the
 * common-dir points at the shared `.git`; in the main checkout they are the
 * same. Falls back to false if git isn't available (e.g. a CI tarball), so
 * non-worktree behavior is always the safe default.
 */
export function isLinkedWorktree() {
  try {
    const gitDir = git(["rev-parse", "--absolute-git-dir"]);
    const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    return Boolean(gitDir) && gitDir !== commonDir;
  } catch {
    return false;
  }
}

/**
 * Deterministic 1–899 offset derived from the current directory path, so each
 * worktree gets its own stable port band without runtime probing. Used to
 * spread dev/test ports across parallel worktrees. NEVER 0 — a 0 offset would
 * land a worktree on the main checkout's base port (5173 / 3100), and CT has no
 * strictPort auto-bump to recover from that clash.
 */
export function portOffset() {
  const key = process.cwd();
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 899) + 1;
}
