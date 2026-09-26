import { afterEach, describe, it, expect, vi } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import { exportPKCS8, generateKeyPair } from "jose";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// Удаление аккаунта из приложения (App Store Review Guideline 5.1.1(v)): стирает
// ВСЁ, что связано с пользователем, — данные приложения и строки Convex Auth.
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

afterEach(() => {
  vi.unstubAllEnvs();
});

// Полный signUp доходит до выпуска JWT — ему нужны env прод-деплоя (как в auth.test).
async function stubJwtEnv() {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("JWT_PRIVATE_KEY", await exportPKCS8(privateKey));
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("SITE_URL", "http://localhost:5173");
}

// Настоящий пользователь через signUp (users + authAccounts + authSessions +
// authRefreshTokens), плюс строки приложения и «хвосты» Convex Auth, которые
// тоже должны уйти: счётчик неудачных входов и код подтверждения аккаунта.
async function seedUser(t: TestConvex<typeof schema>, email: string) {
  await t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password: "12345678q", flow: "signUp" },
  });
  return await t.run(async (ctx) => {
    const account = (await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
      .unique())!;
    const userId = account.userId;
    const session = (await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first())!;
    const now = Date.now();
    await ctx.db.insert("progress", {
      userId,
      lessonKey: "greetings_1",
      pt: "Olá",
      interval: 1,
      ef: 2.5,
      due: now,
      seen: 1,
      correct: 1,
      lastSeen: now,
    });
    await ctx.db.insert("theorySeen", { userId, lessonKey: "greetings_1" });
    await ctx.db.insert("userStats", { userId, streak: 3, lastDay: "2026-09-26" });
    await ctx.db.insert("authRateLimits", { identifier: account._id, lastAttemptTime: now, attemptsLeft: 9 });
    await ctx.db.insert("authVerificationCodes", {
      accountId: account._id,
      provider: "password",
      code: "hash",
      expirationTime: now + 60_000,
    });
    return { userId, sessionId: session._id, accountId: account._id };
  });
}

type Seeded = Awaited<ReturnType<typeof seedUser>>;

const asUser = (t: TestConvex<typeof schema>, u: Seeded) =>
  t.withIdentity({ subject: `${u.userId}|${u.sessionId}` });

// Сколько строк любой таблицы ещё ссылается на пользователя.
function rowsOf(t: TestConvex<typeof schema>, u: Seeded) {
  return t.run(async (ctx) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", u.userId))
      .collect();
    let refreshTokens = 0;
    for (const s of [u.sessionId, ...sessions.map((x) => x._id)]) {
      refreshTokens += (
        await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", s as Id<"authSessions">))
          .collect()
      ).length;
    }
    const byUser = async (table: "progress" | "theorySeen" | "userStats") =>
      (await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", u.userId))
        .collect()).length;
    return {
      user: (await ctx.db.get(u.userId)) === null ? 0 : 1,
      accounts: (await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", u.userId))
        .collect()).length,
      sessions: sessions.length,
      refreshTokens,
      rateLimits: (await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", u.accountId))
        .collect()).length,
      verificationCodes: (await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", u.accountId))
        .collect()).length,
      progress: await byUser("progress"),
      theorySeen: await byUser("theorySeen"),
      userStats: await byUser("userStats"),
    };
  });
}

const NOTHING = {
  user: 0,
  accounts: 0,
  sessions: 0,
  refreshTokens: 0,
  rateLimits: 0,
  verificationCodes: 0,
  progress: 0,
  theorySeen: 0,
  userStats: 0,
};

describe("account.deleteAccount", () => {
  it("erases the user, every Convex Auth row and all app data — and nobody else's", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    const bob = await seedUser(t, "bob@example.com");
    const bobBefore = await rowsOf(t, bob);
    expect(bobBefore).toMatchObject({ user: 1, accounts: 1, sessions: 1, progress: 1, userStats: 1 });
    expect(bobBefore.refreshTokens).toBeGreaterThan(0);

    await asUser(t, alice).mutation(api.account.deleteAccount, {});

    expect(await rowsOf(t, alice)).toEqual(NOTHING);
    expect(await rowsOf(t, bob)).toEqual(bobBefore);
  });

  it("rejects an anonymous caller", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.account.deleteAccount, {})).rejects.toThrow(/Not authenticated/);
  });

  // JWT живёт до истечения и после удаления сессии (Convex Auth не проверяет
  // сессию на каждом вызове): старый токен не должен плодить строки-сироты.
  it("a stale token of the deleted user can no longer write progress", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await asUser(t, alice).mutation(api.account.deleteAccount, {});

    await expect(
      asUser(t, alice).mutation(api.progress.markTheorySeen, { lessonKey: "greetings_1" }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      asUser(t, alice).mutation(api.progress.recordAnswer, {
        lessonKey: "greetings_1",
        pt: "Olá",
        quality: 2,
        mode: "mc",
      }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(asUser(t, alice).mutation(api.account.deleteAccount, {})).rejects.toThrow(
      /Not authenticated/,
    );
    expect(await rowsOf(t, alice)).toEqual(NOTHING);
  });

  it("frees the email: the same address can register again from scratch", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await asUser(t, alice).mutation(api.account.deleteAccount, {});

    const again = await seedUser(t, "alice@example.com");
    expect(again.userId).not.toBe(alice.userId);
    const rows = await rowsOf(t, again);
    expect(rows).toMatchObject({ user: 1, accounts: 1, sessions: 1 });
  });
});

describe("account.viewer", () => {
  it("returns the signed-in user's email, null for an anonymous caller", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    expect(await asUser(t, alice).query(api.account.viewer, {})).toEqual({ email: "alice@example.com" });
    expect(await t.query(api.account.viewer, {})).toBeNull();
  });

  it("is null once the account is deleted (stale token)", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await asUser(t, alice).mutation(api.account.deleteAccount, {});
    expect(await asUser(t, alice).query(api.account.viewer, {})).toBeNull();
  });
});
