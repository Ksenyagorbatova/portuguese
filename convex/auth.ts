import { Password } from "@convex-dev/auth/providers/Password";
import {
  convexAuth,
  modifyAccountCredentials,
  retrieveAccount,
  type ConvexCredentialsConfig,
  type GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";

// Password (email + password) works out of the box — no external setup needed.
//
// ─── Public registration is ENABLED (re-opened 2026-09-26) ───────────────────
// Owner's decision for the iOS/TestFlight rollout: testers must be able to
// create an account from the phone. The gate stays in place as a kill switch:
// flip SIGNUP_ENABLED to false to close sign-up again. The block lives in
// profile(), which Convex Auth's Password.authorize() calls for EVERY flow (and
// passes `flow`) BEFORE creating/fetching the account — so with the flag off a
// "signUp" is rejected before any user/account row is written, while "signIn"
// (and future reset/verify) are untouched. The matching client-side flag lives
// in src/components/SignIn.tsx — keep BOTH in sync.
//
// To enable OAuth later:
//   1. Create GitHub/Google OAuth apps with callback URL
//      https://<your-deployment>.convex.site/api/auth/callback/<provider>
//   2. Set Convex env: AUTH_GITHUB_ID/AUTH_GITHUB_SECRET (and/or Google).
//   3. Uncomment the imports + providers below.
//   4. Flip OAUTH_ENABLED to true in src/components/SignIn.tsx.
// import GitHub from "@auth/core/providers/github";
// import Google from "@auth/core/providers/google";

// Public registration switch (also flip the client flag in SignIn.tsx).
// false → server rejects every signUp with REGISTRATION_DISABLED.
export const SIGNUP_ENABLED = true;

// Error codes (ConvexError data — unlike plain Errors they survive to production
// clients, so SignIn.tsx can show a specific message).
export const REGISTRATION_DISABLED = "REGISTRATION_DISABLED"; // kill switch closed
export const ACCOUNT_EXISTS = "ACCOUNT_EXISTS"; // signUp on a taken email
export const INVALID_EMAIL = "INVALID_EMAIL"; // malformed email (any flow)

// The kill switch as a pure function (tested with enabled=false while the flag
// is on): only the signUp flow is gated; signIn/reset are never affected.
export function assertSignUpAllowed(flow: unknown, enabled: boolean = SIGNUP_ENABLED): void {
  if (!enabled && flow === "signUp") throw new ConvexError(REGISTRATION_DISABLED);
}

const password = Password<DataModel>({
  profile(params) {
    assertSignUpAllowed(params.flow);
    // Нормализация email (trim + lower). Password.authorize берёт email
    // ИЗ РЕЗУЛЬТАТА profile() для всех флоу — и как account id при signUp,
    // и для поиска аккаунта при signIn (см. dist/providers/Password.js:
    // `const { email } = profile; … retrieveAccount({ account: { id: email } })`).
    // Поэтому нормализации здесь достаточно: «Email@X.com» и «email@x.com»
    // попадают в один аккаунт. Прод-аккаунты уже в нижнем регистре.
    return { email: validEmail(params.email) };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [rejectSignUpForExistingAccounts(password) /*, GitHub, Google */],
});

// trim + lowercase — каноническая форма email, под которой хранятся аккаунты
// (authAccounts.providerAccountId и users.email).
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// С открытой регистрацией сервер — единственный фильтр (клиентский type=email
// обходится прямым вызовом auth:signIn): без неё создавались аккаунты с id "" и
// «not-an-email». Проверка — «что-то@домен.зона» без пробелов, как у type=email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validEmail(raw: unknown): string {
  const email = typeof raw === "string" ? normalizeEmail(raw) : "";
  if (!EMAIL_RE.test(email)) throw new ConvexError(INVALID_EMAIL);
  return email;
}

type Authorize = (
  params: Record<string, unknown>,
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
) => Promise<unknown>;

// Безопасность открытой регистрации. Библиотечный signUp для УЖЕ существующего
// аккаунта сверяет присланный пароль (createAccountFromCredentials) и при
// совпадении выдаёт сессию — в обход лимита неудачных попыток, который есть
// только у signIn (retrieveAccountWithCredentials). Пока регистрация была
// закрыта, флоу был недостижим; открытым он стал бы неограниченным подбором
// пароля. Поэтому signUp на занятый email отказывает (ACCOUNT_EXISTS) ДО любой
// проверки пароля; вход — только через signIn с его лимитом.
//
// Password() держит настоящий authorize во внутреннем поле `options`, которое
// convexAuth накладывает поверх провайдера (dist/server/provider_utils.js,
// providerDefaults: merge(provider, provider.options)) — оборачиваем там. Если
// форма провайдера сменится при обновлении библиотеки, модуль упадёт при
// деплое (и auth.test.ts), а не молча откроет дыру.
function rejectSignUpForExistingAccounts(provider: ConvexCredentialsConfig): ConvexCredentialsConfig {
  const options = (provider as unknown as { options?: { authorize?: Authorize } }).options;
  const authorize = options?.authorize;
  if (!options || !authorize) {
    throw new Error("Password provider shape changed: options.authorize is missing");
  }
  const guarded: Authorize = async (params, ctx) => {
    if (params.flow === "signUp") {
      assertSignUpAllowed(params.flow); // закрытая регистрация не раскрывает, занят ли email
      const email = validEmail(params.email);
      if (await accountExists(ctx, email)) throw new ConvexError(ACCOUNT_EXISTS);
    }
    return authorize(params, ctx);
  };
  return { ...provider, options: { ...options, authorize: guarded } } as ConvexCredentialsConfig;
}

// Поиск без секрета: retrieveAccount не сверяет пароль и не трогает лимитер;
// отсутствие аккаунта — Error("InvalidAccountId").
async function accountExists(
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  email: string,
): Promise<boolean> {
  try {
    await retrieveAccount(ctx, { provider: "password", account: { id: email } });
    return true;
  } catch (e) {
    if (e instanceof Error && e.message === "InvalidAccountId") return false;
    throw e;
  }
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
