import { afterEach, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { USER_OWNED_TABLES } from "./account";
import { ACCOUNT_DELETED } from "./auth";
import { signUpWith, stubJwtEnv, type T } from "../src/test/convexAuth";

// Удаление аккаунта из приложения (App Store Review Guideline 5.1.1(v)): стирает
// ВСЁ, что связано с пользователем, — данные приложения и строки Convex Auth.
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// Настоящий пользователь через signUp (users + authAccounts + authSessions +
// authRefreshTokens), плюс строки приложения и «хвосты» Convex Auth, которые
// тоже должны уйти: счётчики неудачных входов (по _id аккаунта и по email) и
// код подтверждения аккаунта.
async function seedUser(t: T, email: string) {
  await signUpWith(t, email);
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
    // Поток кодов подтверждения ведёт лимит по сырому email (verifyCodeAndSignIn).
    await ctx.db.insert("authRateLimits", { identifier: email, lastAttemptTime: now, attemptsLeft: 9 });
    await ctx.db.insert("authVerificationCodes", {
      accountId: account._id,
      provider: "password",
      code: "hash",
      expirationTime: now + 60_000,
    });
    return { email, userId, sessionId: session._id, accountId: account._id };
  });
}

type Seeded = Awaited<ReturnType<typeof seedUser>>;

const asUser = (t: T, u: Seeded) => t.withIdentity({ subject: `${u.userId}|${u.sessionId}` });

// Сколько строк любой таблицы ещё ссылается на пользователя.
function rowsOf(t: T, u: Seeded) {
  return t.run(async (ctx) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", u.userId))
      .collect();
    // Известная сессия + текущие (Set — без двойного счёта живой сессии).
    const sessionIds = new Set<Id<"authSessions">>([u.sessionId, ...sessions.map((s) => s._id)]);
    let refreshTokens = 0;
    for (const sessionId of sessionIds) {
      refreshTokens += (
        await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      ).length;
    }
    const byUser = async (table: (typeof USER_OWNED_TABLES)[number]) =>
      (await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", u.userId))
        .collect()).length;
    const rateLimits = async (identifier: string) =>
      (await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", identifier))
        .collect()).length;
    return {
      user: (await ctx.db.get(u.userId)) === null ? 0 : 1,
      accounts: (await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", u.userId))
        .collect()).length,
      sessions: sessions.length,
      refreshTokens,
      rateLimits: (await rateLimits(u.accountId)) + (await rateLimits(u.email)),
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

// Удаление + отложенная зачистка refresh-токенов (планировщик).
async function deleteFully(t: T, u: Seeded) {
  await asUser(t, u).mutation(api.account.deleteAccount, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("account.deleteAccount", () => {
  it("erases the user, every Convex Auth row and all app data — and nobody else's", async () => {
    vi.useFakeTimers();
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    const bob = await seedUser(t, "bob@example.com");
    const bobBefore = await rowsOf(t, bob);
    expect(bobBefore).toMatchObject({ user: 1, accounts: 1, sessions: 1, refreshTokens: 1, rateLimits: 2 });

    await deleteFully(t, alice);

    expect(await rowsOf(t, alice)).toEqual(NOTHING);
    expect(await rowsOf(t, bob)).toEqual(bobBefore);
  });

  // Сессии уходят в той же транзакции (refresh по ним сразу невозможен), а их
  // refresh-токены — пачками в фоне: у брошенных сессий их бывают тысячи.
  it("revokes every session at once and purges any number of refresh tokens in batches", async () => {
    vi.useFakeTimers();
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    const extra = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("authSessions", {
        userId: alice.userId,
        expirationTime: Date.now() + 86_400_000,
      });
      for (let i = 0; i < 2_300; i++) {
        await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 86_400_000 });
      }
      return sessionId;
    });

    await asUser(t, alice).mutation(api.account.deleteAccount, {});
    const right = await t.run(async (ctx) => ({
      sessions: (await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", alice.userId))
        .collect()).length,
      extraTokens: (await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", extra))
        .collect()).length,
    }));
    expect(right.sessions).toBe(0);
    expect(right.extraTokens).toBeGreaterThan(0); // ещё не вычищены — это делает фон

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(
      async (ctx) =>
        (await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", extra))
          .collect()).length,
    );
    expect(left).toBe(0);
    expect(await rowsOf(t, alice)).toEqual(NOTHING);
  });

  it("rejects an anonymous caller", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.account.deleteAccount, {})).rejects.toThrow(/Not authenticated/);
  });

  // JWT живёт до истечения и после удаления аккаунта (Convex Auth не проверяет
  // сессию на каждом вызове): старый токен не должен ни писать строки-сироты,
  // ни получать данные.
  it("a stale token of the deleted user can no longer read or write", async () => {
    vi.useFakeTimers();
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await deleteFully(t, alice);

    const as = asUser(t, alice);
    await expect(as.mutation(api.progress.markTheorySeen, { lessonKey: "greetings_1" })).rejects.toThrow(
      /Not authenticated/,
    );
    await expect(
      as.mutation(api.progress.recordAnswer, { lessonKey: "greetings_1", pt: "Olá", quality: 2, mode: "mc" }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(as.mutation(api.account.deleteAccount, {})).rejects.toThrow(/Not authenticated/);
    expect(await as.query(api.progress.getSrsState, {})).toBeNull();
    expect(await as.query(api.courseQueries.getCourse, {})).toBeNull();
    expect(await rowsOf(t, alice)).toEqual(NOTHING);
  });

  // Выход удаляет сессию, но JWT ещё до часа валиден: копией такого токена
  // необратимое удаление (и любые записи) делать нельзя.
  it("a token of a signed-out (revoked) session cannot delete the account", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await t.run((ctx) => ctx.db.delete(alice.sessionId));

    await expect(asUser(t, alice).mutation(api.account.deleteAccount, {})).rejects.toThrow(
      /Not authenticated/,
    );
    expect(await asUser(t, alice).query(api.account.viewer, {})).toEqual({ state: "gone" });
    expect((await rowsOf(t, alice)).user).toBe(1);
  });

  // Password-вход — две транзакции (поиск аккаунта → создание сессии): вход,
  // начатый до удаления, не должен создать сессию-сироту удалённому пользователю.
  it("no session can be created for a deleted user (sign-in racing the deletion)", async () => {
    vi.useFakeTimers();
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await deleteFully(t, alice);

    await expect(
      t.mutation(internal.auth.store, {
        args: { type: "signIn", userId: alice.userId, generateTokens: false },
      }),
    ).rejects.toThrow(ACCOUNT_DELETED);
    expect(await rowsOf(t, alice)).toEqual(NOTHING);
  });

  it("frees the email: the same address can register again from scratch", async () => {
    vi.useFakeTimers();
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await deleteFully(t, alice);

    const again = await seedUser(t, "alice@example.com");
    expect(again.userId).not.toBe(alice.userId);
    expect(await rowsOf(t, again)).toMatchObject({ user: 1, accounts: 1, sessions: 1 });
  });

  // Страж полноты: любая таблица приложения со ссылкой на users обязана быть в
  // USER_OWNED_TABLES (и иметь индекс by_user) — иначе её строки переживут
  // «Удалить навсегда». Auth-таблицы deleteAccount чистит явно.
  it("covers every app table that references users (schema-derived)", () => {
    const AUTH_TABLES = new Set([
      "users",
      "authSessions",
      "authAccounts",
      "authRefreshTokens",
      "authVerificationCodes",
      "authVerifiers",
      "authRateLimits",
    ]);
    type Field = { kind: string; tableName?: string };
    const tables = schema.tables as unknown as Record<
      string,
      { validator: { fields: Record<string, Field> }; indexes: { indexDescriptor: string }[] }
    >;
    const owned = Object.entries(tables)
      .filter(([name]) => !AUTH_TABLES.has(name))
      .filter(([, table]) =>
        Object.values(table.validator.fields).some((f) => f.kind === "id" && f.tableName === "users"),
      )
      .map(([name]) => name)
      .sort();
    expect(owned).toEqual([...USER_OWNED_TABLES].sort());
    for (const name of USER_OWNED_TABLES) {
      expect(tables[name].indexes.map((i) => i.indexDescriptor)).toContain("by_user");
    }
  });
});

describe("account.viewer", () => {
  it("tells a live user (with email) from an anonymous caller", async () => {
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    expect(await asUser(t, alice).query(api.account.viewer, {})).toEqual({
      state: "live",
      email: "alice@example.com",
    });
    expect(await t.query(api.account.viewer, {})).toBeNull();
  });

  // «gone» — сигнал клиенту выйти: токен ещё валиден, а аккаунта уже нет
  // (удалили с другого устройства) — иначе экран висел бы на загрузке.
  it("reports «gone» once the account is deleted (stale token)", async () => {
    vi.useFakeTimers();
    await stubJwtEnv();
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.com");
    await deleteFully(t, alice);
    expect(await asUser(t, alice).query(api.account.viewer, {})).toEqual({ state: "gone" });
  });
});
