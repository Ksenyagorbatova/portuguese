// Единственный модуль, которому можно читать сырой id из JWT: остальные
// функции получают пользователя через liveUserId/requireLiveUserId (правило
// no-restricted-imports в .oxlintrc.json).
// oxlint-disable-next-line no-restricted-imports
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ─── Аккаунт: кто я и удаление (App Store Review Guideline 5.1.1(v)) ─────────
// Приложение с регистрацией обязано давать удалить аккаунт изнутри — вместе с
// данными, а не «деактивировать». См. specs/feature/auth-and-signup-gate.md.

// Таблицы приложения с данными пользователя (индекс by_user). Новая таблица со
// ссылкой на users — сюда: тест account.test.ts сверяет список со схемой.
export const USER_OWNED_TABLES = ["progress", "theorySeen", "userStats"] as const;

type Caller =
  | { state: "anonymous" }
  | { state: "gone" }
  | { state: "live"; userId: Id<"users">; email: string | null };

// Кто вызывает. JWT Convex Auth действует до истечения и после выхода или
// удаления аккаунта (библиотека не сверяется с сессией на каждом вызове),
// поэтому «живой» — только если в базе есть и пользователь, и его сессия
// (документированный паттерн Convex Auth: getAuthSessionId + проверка сессии).
// «gone» — токен валиден, а аккаунта или сессии уже нет.
async function whoCalls(ctx: QueryCtx): Promise<Caller> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return { state: "anonymous" };
  const sessionId = await getAuthSessionId(ctx);
  const [user, session] = await Promise.all([ctx.db.get(userId), sessionId ? ctx.db.get(sessionId) : null]);
  if (user === null || session === null) return { state: "gone" };
  return { state: "live", userId, email: user.email ?? null };
}

// id живого пользователя вызова или null (гость, выход, удалённый аккаунт).
export async function liveUserId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const caller = await whoCalls(ctx);
  return caller.state === "live" ? caller.userId : null;
}

// То же для функций, которым без пользователя делать нечего (все записи).
export async function requireLiveUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await liveUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

// Для клиента: null — гость; «live» — email для строки аккаунта; «gone» —
// аккаунт или сессия удалены при ещё валидном токене (например, удалили с
// другого устройства): клиент по этому сигналу выходит, а не висит на загрузке.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const caller = await whoCalls(ctx);
    if (caller.state === "anonymous") return null;
    if (caller.state === "gone") return { state: "gone" as const };
    return { state: "live" as const, email: caller.email };
  },
});

// Удаляет вызывающего пользователя одной транзакцией: данные приложения,
// аккаунты провайдеров с кодами подтверждения и счётчиками неудачных входов
// (идентификатор — _id аккаунта у входа по паролю и сырой email у потока кодов,
// см. rateLimit/verifyCodeAndSignIn в @convex-dev/auth), сессии (refresh по
// ним сразу становится невозможен) и сам users-документ. Email свободен для
// новой регистрации. refresh-токены сессий — отдельно, пачками в фоне
// (purgeRefreshTokens): у брошенных сессий их бывают тысячи, в один лимит
// транзакции они могут не влезть. authVerifiers (PKCE для OAuth) у входа по
// паролю не создаются, OAuth выключен — их не трогаем.
// Клиент после успеха зовёт signOut(): сессии уже нет, он лишь стирает токены.
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireLiveUserId(ctx);
    const user = await ctx.db.get(userId);

    for (const table of USER_OWNED_TABLES) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    const rateLimitIds = new Set<string>(user?.email ? [user.email] : []);
    for (const account of accounts) {
      rateLimitIds.add(account._id).add(account.providerAccountId);
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }
    for (const identifier of rateLimitIds) {
      const limits = await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", identifier))
        .collect();
      for (const limit of limits) await ctx.db.delete(limit._id);
    }

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    if (sessions.length > 0) {
      await ctx.scheduler.runAfter(0, internal.account.purgeRefreshTokens, {
        sessionIds: sessions.map((s) => s._id),
      });
    }

    await ctx.db.delete(userId);
  },
});

// Сколько refresh-токенов удалять за один запуск (далеко от лимитов транзакции).
const PURGE_BATCH = 1_000;

// Фоновая зачистка refresh-токенов удалённых сессий: пачками по PURGE_BATCH,
// перепланирует себя, пока не вычистит всё.
export const purgeRefreshTokens = internalMutation({
  args: { sessionIds: v.array(v.id("authSessions")) },
  handler: async (ctx, { sessionIds }) => {
    const remaining = [...sessionIds];
    let budget = PURGE_BATCH;
    while (remaining.length > 0 && budget > 0) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", remaining[0]))
        .take(budget);
      for (const token of tokens) await ctx.db.delete(token._id);
      budget -= tokens.length;
      // Меньше запрошенного — у этой сессии токенов больше нет.
      if (budget > 0) remaining.shift();
    }
    if (remaining.length > 0) {
      await ctx.scheduler.runAfter(0, internal.account.purgeRefreshTokens, { sessionIds: remaining });
    }
  },
});
