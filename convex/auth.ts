import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

// Password (email + password) works out of the box — no external setup needed.
//
// ─── Public registration is currently DISABLED ───────────────────────────────
// Flip SIGNUP_ENABLED back to true to re-open sign-up. Nothing is removed: the
// Password provider stays fully wired up. The block lives in profile(), which
// Convex Auth's Password.authorize() calls for EVERY flow (and passes `flow`)
// BEFORE creating/fetching the account — so a "signUp" is rejected before any
// user/account row is written, while "signIn" (and future reset/verify) are
// untouched. The matching client-side flag lives in src/components/SignIn.tsx —
// flip BOTH to fully restore registration.
//
// To enable OAuth later:
//   1. Create GitHub/Google OAuth apps with callback URL
//      https://<your-deployment>.convex.site/api/auth/callback/<provider>
//   2. Set Convex env: AUTH_GITHUB_ID/AUTH_GITHUB_SECRET (and/or Google).
//   3. Uncomment the imports + providers below.
//   4. Flip OAUTH_ENABLED to true in src/components/SignIn.tsx.
// import GitHub from "@auth/core/providers/github";
// import Google from "@auth/core/providers/google";

// Flip to true to re-open public registration (also flip the client flag).
export const SIGNUP_ENABLED = false;

// Error code thrown when sign-up is attempted while disabled (the client can
// match on this to show a friendly message).
export const REGISTRATION_DISABLED = "REGISTRATION_DISABLED";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (!SIGNUP_ENABLED && params.flow === "signUp") {
          throw new ConvexError(REGISTRATION_DISABLED);
        }
        return { email: params.email as string };
      },
    }) /*, GitHub, Google */,
  ],
});
