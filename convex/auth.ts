import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Password (email + password) works out of the box — no external setup needed.
//
// To enable OAuth later:
//   1. Create GitHub/Google OAuth apps with callback URL
//      https://<your-deployment>.convex.site/api/auth/callback/<provider>
//   2. Set Convex env: AUTH_GITHUB_ID/AUTH_GITHUB_SECRET (and/or Google).
//   3. Uncomment the imports + providers below.
//   4. Flip OAUTH_ENABLED to true in src/components/SignIn.tsx.
// import GitHub from "@auth/core/providers/github";
// import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password /*, GitHub, Google */],
});
