import { ConvexError } from "convex/values";

// Test stub for "@convex-dev/auth/react" used in Playwright CT (aliased in
// playwright-ct.config.ts). Lets auth-dependent components mount without a live
// Convex client. signIn is inert (signOut only counts calls in
// window.__signOutCalls), unless a test sets
// `window.__signInError` (page.evaluate AFTER mount — the first mount in a
// worker navigates and would wipe it): then signIn rejects the way the server
// does — ConvexError(code) for a string, a plain Error for `true`.
declare global {
  interface Window {
    __signInError?: string | true;
    // Сколько раз звали signOut — тест читает обратно (удаление аккаунта).
    __signOutCalls?: number;
  }
}

export function useAuthActions() {
  return {
    signIn: async () => {
      const failure = window.__signInError;
      if (failure === true) throw new Error("[CONVEX A(auth:signIn)] Server Error");
      if (failure) throw new ConvexError(failure);
      return { signingIn: false, redirect: undefined };
    },
    signOut: async () => {
      window.__signOutCalls = (window.__signOutCalls ?? 0) + 1;
    },
  };
}
