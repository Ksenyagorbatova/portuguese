import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, modifyAccountCredentials } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";

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
        // Нормализация email (trim + lower). Password.authorize берёт email
        // ИЗ РЕЗУЛЬТАТА profile() для всех флоу — и как account id при signUp,
        // и для поиска аккаунта при signIn (см. dist/providers/Password.js:
        // `const { email } = profile; … retrieveAccount({ account: { id: email } })`).
        // Поэтому нормализации здесь достаточно: «Email@X.com» и «email@x.com»
        // попадают в один аккаунт. Прод-аккаунты уже в нижнем регистре.
        return { email: normalizeEmail(params.email as string) };
      },
    }) /*, GitHub, Google */,
  ],
});

// trim + lowercase — каноническая форма email, под которой хранятся аккаунты
// (authAccounts.providerAccountId и users.email).
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── adminResetPassword — ручной сброс пароля через CLI ─────────────────────
// Self-hosted-замена флоу «забыли пароль» (email-провайдера для reset-писем у
// проекта нет): админ задаёт пользователю новый пароль напрямую.
//
//   npx convex run --prod auth:adminResetPassword '{"email":"...","newPassword":"..."}'
//
// internalAction — клиенту недоступна по построению (вызов только через CLI с
// deploy-ключом или из серверного кода), это и есть гейт; работать должна и на
// проде, поэтому env-гейтов как у seedLocal здесь нет. modifyAccountCredentials
// хеширует новый секрет scrypt'ом провайдера Password и падает, если аккаунта
// с таким email нет. Существующие сессии НЕ инвалидируются (владелец и есть
// единственный пользователь).
export const adminResetPassword = internalAction({
  args: { email: v.string(), newPassword: v.string() },
  handler: async (ctx, { email, newPassword }) => {
    // Серверный минимум провайдера Password — 8 символов; короче зашить нельзя,
    // иначе вход с этим паролем валиден, а «смена пароля» через signIn-флоу нет.
    if (newPassword.length < 8) {
      throw new ConvexError("password too short: minimum 8 characters");
    }
    const id = normalizeEmail(email);
    await modifyAccountCredentials<DataModel>(ctx, {
      provider: "password",
      account: { id, secret: newPassword },
    });
    return { email: id };
  },
});
