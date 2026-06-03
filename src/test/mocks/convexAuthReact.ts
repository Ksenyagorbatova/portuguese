// Test stub for "@convex-dev/auth/react" used in Playwright CT (aliased in
// playwright-ct.config.ts). Lets auth-dependent components mount without a live
// Convex client. signIn/signOut are inert.
export function useAuthActions() {
  return {
    signIn: async () => ({ signingIn: false, redirect: undefined }),
    signOut: async () => undefined,
  };
}
