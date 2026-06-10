import { afterEach, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";
import { DEV_EMAIL, DEV_PASSWORD } from "./seed";

// Load all Convex modules for the in-memory backend (includes _generated;
// excludes the test files themselves).
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

describe("seedContent", () => {
  it("seeds the course and is idempotent (no duplicates on re-run)", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.seed.seedContent, {});
    const second = await t.mutation(internal.seed.seedContent, {});

    // Same reported counts both times (включая нулевой prune — чистая БД).
    expect(second).toEqual(first);
    expect(first.topics).toBeGreaterThan(0);
    expect(first.words).toBeGreaterThan(0);
    expect(first.pruned).toEqual({ topics: 0, lessons: 0, words: 0, crossSentences: 0 });

    // DB holds exactly the reported number of rows — upsert, not duplicate.
    const topics = await t.run((ctx) => ctx.db.query("topics").collect());
    const words = await t.run((ctx) => ctx.db.query("words").collect());
    const sentences = await t.run((ctx) => ctx.db.query("crossSentences").collect());
    expect(topics).toHaveLength(first.topics);
    expect(words).toHaveLength(first.words);
    expect(sentences).toHaveLength(first.crossSentences);
  });
});

describe("seedContent — prune контентных сирот", () => {
  it("удаляет контентные строки, чьих натуральных ключей больше нет в content.ts", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.seed.seedContent, {});

    // «Осиротевший» контент: ключи, которых нет (и не будет) в content.ts.
    await t.run(async (ctx) => {
      await ctx.db.insert("topics", {
        topicKey: "ghost_topic",
        label: "Ghost",
        icon: "👻",
        order: 999,
      });
      await ctx.db.insert("lessons", {
        lessonKey: "ghost_lesson",
        topicKey: "ghost_topic",
        label: "Ghost",
        order: 999,
        theory: { intro: "", tip: "", sections: [] },
      });
      await ctx.db.insert("words", {
        lessonKey: "ghost_lesson",
        pt: "fantasma",
        ru: "призрак",
        order: 999,
      });
      await ctx.db.insert("crossSentences", {
        sentenceKey: "cs_9999",
        words: ["x"],
        answer: "x",
        ru: "х",
        required: [],
        order: 999,
      });
    });

    const res = await t.mutation(internal.seed.seedContent, {});
    expect(res.pruned).toEqual({ topics: 1, lessons: 1, words: 1, crossSentences: 1 });

    // Таблицы вернулись ровно к каноническому составу content.ts.
    expect(await t.run((ctx) => ctx.db.query("topics").collect())).toHaveLength(first.topics);
    expect(await t.run((ctx) => ctx.db.query("words").collect())).toHaveLength(first.words);
    const ghosts = await t.run((ctx) =>
      ctx.db
        .query("words")
        .withIndex("by_lessonKey_pt", (q) => q.eq("lessonKey", "ghost_lesson").eq("pt", "fantasma"))
        .collect(),
    );
    expect(ghosts).toHaveLength(0);

    // Повторный сид — no-op (идемпотентность сохранена).
    const again = await t.mutation(internal.seed.seedContent, {});
    expect(again).toEqual(first);
  });

  it("НЕ трогает per-user таблицы: progress с осиротевшим ключом остаётся", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedContent, {});

    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    // Прогресс по слову, которого больше нет в контенте (например, удалили урок).
    await t.run(async (ctx) => {
      await ctx.db.insert("progress", {
        userId,
        lessonKey: "removed_lesson",
        pt: "antigo",
        interval: 6,
        ef: 2.5,
        due: Date.now(),
        seen: 4,
        correct: 4,
        lastSeen: Date.now(),
        mcCorrect: 3,
        typeCorrect: 1,
      });
      await ctx.db.insert("theorySeen", { userId, lessonKey: "removed_lesson" });
      await ctx.db.insert("userStats", { userId, streak: 7, lastDay: "2026-06-09" });
    });

    await t.mutation(internal.seed.seedContent, {});

    const progress = await t.run((ctx) => ctx.db.query("progress").collect());
    const theory = await t.run((ctx) => ctx.db.query("theorySeen").collect());
    const stats = await t.run((ctx) => ctx.db.query("userStats").collect());
    expect(progress).toHaveLength(1);
    expect(progress[0].lessonKey).toBe("removed_lesson");
    expect(theory).toHaveLength(1);
    expect(stats).toHaveLength(1);
    expect(stats[0].streak).toBe(7);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("seed.seedLocal — защита деплоя", () => {
  it("без ALLOW_DEV_SEED отказывается и ничего не создаёт", async () => {
    const t = convexTest(schema, modules);
    // Нет env-стаба → ALLOW_DEV_SEED не задан, как на облачном dev/prod.
    await expect(t.action(internal.seed.seedLocal, {})).rejects.toThrow(/ALLOW_DEV_SEED/);

    expect(await t.query(internal.seed.findUserByEmail, { email: DEV_EMAIL })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
    // Контент тоже не залит — действие отвалилось до сида.
    expect(await t.run((ctx) => ctx.db.query("topics").collect())).toHaveLength(0);
  });

  it("на облачном CONVEX_CLOUD_URL отказывается даже с ALLOW_DEV_SEED", async () => {
    // Облачный CONVEX_CLOUD_URL обязан дисквалифицировать деплой сам по себе —
    // это backend-owned предохранитель, который скрипт сида не может подделать.
    vi.stubEnv("ALLOW_DEV_SEED", "1");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://happy-animal-123.convex.cloud");
    const t = convexTest(schema, modules);

    await expect(t.action(internal.seed.seedLocal, {})).rejects.toThrow(/не-локальном|CONVEX_CLOUD_URL/);
    expect(await t.query(internal.seed.findUserByEmail, { email: DEV_EMAIL })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
  });

  it("локальный 127.0.0.1 + opt-in — проходит", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "1");
    vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
    const t = convexTest(schema, modules);

    const result = await t.action(internal.seed.seedLocal, {});
    expect(result.createdAccount).toBe(true);
  });
});

describe("seed.seedLocal — dev-аккаунт + контент", () => {
  it("создаёт dev-пользователя и заливает контент", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "1");
    const t = convexTest(schema, modules);

    const result = await t.action(internal.seed.seedLocal, {});
    expect(result.email).toBe(DEV_EMAIL);
    expect(result.createdAccount).toBe(true);
    expect(result.topics).toBeGreaterThan(0);
    expect(result.words).toBeGreaterThan(0);

    const userId = await t.query(internal.seed.findUserByEmail, { email: DEV_EMAIL });
    expect(userId).not.toBeNull();
    // Контент реально в БД (слов столько, сколько отрапортовал сид).
    expect((await t.run((ctx) => ctx.db.query("words").collect())).length).toBe(result.words);
  });

  it("пароль хранится хешированным (вход реально работает)", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "1");
    const t = convexTest(schema, modules);
    await t.action(internal.seed.seedLocal, {});

    const accounts = await t.run((ctx) => ctx.db.query("authAccounts").collect());
    expect(accounts).toHaveLength(1);
    const [account] = accounts;
    expect(account.provider).toBe("password");
    // Id для поиска при входе — нормализованный email.
    expect(account.providerAccountId).toBe(DEV_EMAIL);
    // Хранится через scrypt провайдера Password — захешировано, не plaintext.
    expect(account.secret).toBeTruthy();
    expect(account.secret).not.toBe(DEV_PASSWORD);
  });
});

describe("seed.seedLocal — идемпотентность", () => {
  it("повторный запуск не создаёт дублей аккаунта/контента", async () => {
    vi.stubEnv("ALLOW_DEV_SEED", "1");
    const t = convexTest(schema, modules);

    const first = await t.action(internal.seed.seedLocal, {});
    const second = await t.action(internal.seed.seedLocal, {});

    expect(first.createdAccount).toBe(true);
    expect(second.createdAccount).toBe(false);
    // Контент — идемпотентный upsert: те же счётчики, без дублей строк.
    expect(second.words).toBe(first.words);

    const users = await t.run((ctx) =>
      ctx.db.query("users").withIndex("email", (q) => q.eq("email", DEV_EMAIL)).collect(),
    );
    expect(users).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.query("words").collect())).length).toBe(first.words);
  });
});
