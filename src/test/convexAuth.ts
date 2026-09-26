import { exportPKCS8, generateKeyPair } from "jose";
import { vi } from "vitest";
import type { TestConvex } from "convex-test";
import { api } from "../../convex/_generated/api";
import type schema from "../../convex/schema";
import { DEV_PASSWORD } from "../../convex/seed";

// Общие хелперы backend-тестов (convex/*.test.ts) вокруг Convex Auth. Лежат вне
// convex/, чтобы не попасть в бандл функций; тайпчек — tsconfig.test.json.

export type T = TestConvex<typeof schema>;

// Полный signIn/signUp доходит до выпуска JWT — ему нужны env прод-деплоя.
// Одноразовый RS256-ключ (WebCrypto доступен в edge-runtime). Снимать —
// vi.unstubAllEnvs() в afterEach теста.
export async function stubJwtEnv() {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("JWT_PRIVATE_KEY", await exportPKCS8(privateKey));
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("SITE_URL", "http://localhost:5173");
}

export function signUpWith(t: T, email: string, password: string = DEV_PASSWORD) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signUp" },
  });
}

export function signInWith(t: T, email: string, password: string) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
}

// Пользователь с НАСТОЯЩЕЙ сессией и контекст от его имени. Функции приложения
// проверяют, что живы и users, и authSessions (liveUserId в convex/account.ts:
// JWT действует и после выхода/удаления), так что subject — реальный
// `${userId}|${sessionId}`, а не выдуманный.
export async function asNewUser(t: T) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 30 * 86_400_000,
    });
    return { userId, sessionId };
  });
  return { userId, sessionId, as: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}
