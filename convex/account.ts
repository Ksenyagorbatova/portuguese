import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ─── Аккаунт: кто я и удаление (App Store Review Guideline 5.1.1(v)) ─────────
// Приложение с регистрацией обязано давать удалить аккаунт изнутри — вместе с
// данными, а не «деактивировать». См. specs/feature/auth-and-signup-gate.md.

// Пользователь вызова — только если он ещё существует. getAuthUserId читает id
// из JWT, а JWT действует до истечения и после удаления аккаунта (Convex Auth
// не сверяется с сессией на каждом вызове): без этой проверки старый токен
// удалённого пользователя продолжал бы писать строки-сироты.
export async function liveUserId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return (await ctx.db.get(userId)) === null ? null : userId;
}

// Email вошедшего — для строки «аккаунт» на главном экране. null — гость или
// аккаунт уже удалён.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await liveUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return { email: user?.email ?? null };
  },
});

// Удаляет вызывающего пользователя целиком, одной транзакцией: прогресс,
// теорию и статистику приложения, затем строки Convex Auth — сессии с их
// refresh-токенами (как deleteSession библиотеки), аккаунты провайдеров с
// кодами подтверждения и счётчиками неудачных входов (идентификатор — _id
// аккаунта, см. rateLimit в @convex-dev/auth) и сам users-документ. После
// этого email свободен для новой регистрации. authVerifiers (PKCE для OAuth)
// у Password-входа не создаются, OAuth выключен — их не трогаем.
// Клиент после успеха зовёт signOut(): сессии уже нет, он просто стирает токены.
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await liveUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const progress = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of progress) await ctx.db.delete(row._id);
    const theorySeen = await ctx.db
      .query("theorySeen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of theorySeen) await ctx.db.delete(row._id);
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of stats) await ctx.db.delete(row._id);

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      const limits = await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", account._id))
        .collect();
      for (const limit of limits) await ctx.db.delete(limit._id);
      await ctx.db.delete(account._id);
    }

    await ctx.db.delete(userId);
  },
});
