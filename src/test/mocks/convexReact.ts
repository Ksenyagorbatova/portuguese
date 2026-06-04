// Test stub for "convex/react" (aliased in playwright-ct.config.ts) so
// components that call useMutation/useQuery mount in CT without a live Convex
// client. useMutation returns a no-op that resolves a value shaped like
// progress.recordAnswer (card + streak), which the exercises read for the
// "next review" label.
export function useMutation() {
  return async () => ({
    card: {
      interval: 1,
      ef: 2.5,
      due: Date.now() + 86_400_000,
      seen: 1,
      correct: 1,
      lastSeen: Date.now(),
    },
    streak: 1,
  });
}

export function useQuery() {
  return undefined;
}
