// Test stub for "convex/react" (aliased in playwright-ct.config.ts) so
// components that call useMutation/useQuery mount in CT without a live Convex
// client. useMutation returns a no-op that resolves a value shaped like
// progress.recordAnswer (card + streak), which the exercises read for the
// "next review" label.
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";

export function useMutation() {
  return async () => ({
    card: {
      interval: 1,
      ef: 2.5,
      due: Date.now() + 86_400_000,
      seen: 1,
      correct: 1,
      lastSeen: Date.now(),
      mcCorrect: 1,
      typeCorrect: 0,
    },
    streak: 1,
  });
}

// Per-test query fixtures, keyed by "module:function" name (e.g.
// "courseQueries:getCourse"). Tests pass them through mount's hooksConfig;
// playwright/index.tsx feeds them here in beforeMount — both run in the same
// browser bundle as this stub. Without fixtures every query returns undefined
// (the Convex "loading" state), which is what the older CT tests rely on.
let queryData: Record<string, unknown> = {};

export function __setQueryData(data: Record<string, unknown>): void {
  queryData = data;
}

export function useQuery(ref: FunctionReference<"query">): unknown {
  return queryData[getFunctionName(ref)];
}
