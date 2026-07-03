import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { TOPICS, CROSS_SENTENCES, TOPIC_SENTENCES } from "./content";

// Idempotent content seed. Upserts by natural key (topicKey / lessonKey /
// (lessonKey,pt) / sentenceKey), so it is safe to run on every deploy:
// new entries are inserted, edited ones are patched in place, no duplicates.
// After the upserts a prune pass deletes CONTENT rows whose natural keys are
// gone from content.ts (removed/renamed entries would otherwise linger as
// stale rows forever). Per-user tables (progress/theorySeen/userStats) are
// NEVER touched — user progress survives any re-seed.
// `order` is captured from iteration order (TOPICS object order, lesson/word
// array order) so content queries can restore the original ordering.
//
// Run locally:  npx convex run seed:seedContent
// Run on prod:  npx convex run seed:seedContent --prod   (needs CONVEX_DEPLOY_KEY)
export const seedContent = internalMutation({
  args: {},
  handler: async (ctx) => {
    let topicCount = 0;
    let lessonCount = 0;
    let wordCount = 0;

    // Натуральные ключи, присутствующие в content.ts, — всё прочее в контентных
    // таблицах будет удалено prune-фазой ниже.
    const liveTopicKeys = new Set<string>();
    const liveLessonKeys = new Set<string>();
    const liveWordKeys = new Set<string>(); // `${lessonKey}||${pt}`
    const liveSentenceKeys = new Set<string>();
    const liveTopicSentenceKeys = new Set<string>();

    let ti = 0;
    for (const [topicKey, topic] of Object.entries(TOPICS)) {
      liveTopicKeys.add(topicKey);
      const exT = await ctx.db
        .query("topics")
        .withIndex("by_topicKey", (q) => q.eq("topicKey", topicKey))
        .unique();
      const topicDoc = { topicKey, label: topic.label, icon: topic.icon, order: ti++ };
      if (exT) await ctx.db.patch(exT._id, topicDoc);
      else await ctx.db.insert("topics", topicDoc);
      topicCount++;

      let li = 0;
      for (const lesson of topic.lessons) {
        liveLessonKeys.add(lesson.id);
        const exL = await ctx.db
          .query("lessons")
          .withIndex("by_lessonKey", (q) => q.eq("lessonKey", lesson.id))
          .unique();
        const lessonDoc = {
          lessonKey: lesson.id,
          topicKey,
          label: lesson.label,
          order: li++,
          theory: lesson.theory,
        };
        if (exL) await ctx.db.patch(exL._id, lessonDoc);
        else await ctx.db.insert("lessons", lessonDoc);
        lessonCount++;

        let wi = 0;
        for (const w of lesson.words) {
          liveWordKeys.add(lesson.id + "||" + w.pt);
          const exW = await ctx.db
            .query("words")
            .withIndex("by_lessonKey_pt", (q) =>
              q.eq("lessonKey", lesson.id).eq("pt", w.pt),
            )
            .unique();
          // note: w.note may be undefined → Convex treats that as field-absent on
          // insert, and patch({note: undefined}) clears a stale note on re-seed.
          const wordDoc = {
            lessonKey: lesson.id,
            pt: w.pt,
            ru: w.ru,
            note: w.note,
            order: wi++,
          };
          if (exW) await ctx.db.patch(exW._id, wordDoc);
          else await ctx.db.insert("words", wordDoc);
          wordCount++;
        }
      }
    }

    for (let i = 0; i < CROSS_SENTENCES.length; i++) {
      const s = CROSS_SENTENCES[i];
      const sentenceKey = `cs_${String(i + 1).padStart(4, "0")}`;
      liveSentenceKeys.add(sentenceKey);
      const exS = await ctx.db
        .query("crossSentences")
        .withIndex("by_sentenceKey", (q) => q.eq("sentenceKey", sentenceKey))
        .unique();
      const doc = {
        sentenceKey,
        words: s.words,
        answer: s.answer,
        ru: s.ru,
        required: s.required,
        order: i,
      };
      if (exS) await ctx.db.patch(exS._id, doc);
      else await ctx.db.insert("crossSentences", doc);
    }

    // Раздел «Построение предложений» (per-topic). Те же правила upsert/prune,
    // натуральный ключ ts_NNNN из индекса (append-only, как cs_NNNN).
    for (let i = 0; i < TOPIC_SENTENCES.length; i++) {
      const s = TOPIC_SENTENCES[i];
      const sentenceKey = `ts_${String(i + 1).padStart(4, "0")}`;
      liveTopicSentenceKeys.add(sentenceKey);
      const exS = await ctx.db
        .query("topicSentences")
        .withIndex("by_sentenceKey", (q) => q.eq("sentenceKey", sentenceKey))
        .unique();
      const doc = {
        sentenceKey,
        topicKey: s.topicKey,
        words: s.words,
        answer: s.answer,
        ru: s.ru,
        blank: s.blank,
        order: i,
      };
      if (exS) await ctx.db.patch(exS._id, doc);
      else await ctx.db.insert("topicSentences", doc);
    }

    // ─── Prune: контентные строки, чьих натуральных ключей больше нет в
    // content.ts. ТОЛЬКО контентные таблицы — progress/theorySeen/userStats не
    // трогаем НИКОГДА: прогресс пользователей переживает любой ре-сид, а
    // осиротевшие progress-строки просто лежат без вреда (их никто не читает).
    const pruned = { topics: 0, lessons: 0, words: 0, crossSentences: 0, topicSentences: 0 };
    for (const t of await ctx.db.query("topics").collect())
      if (!liveTopicKeys.has(t.topicKey)) {
        await ctx.db.delete(t._id);
        pruned.topics++;
      }
    for (const l of await ctx.db.query("lessons").collect())
      if (!liveLessonKeys.has(l.lessonKey)) {
        await ctx.db.delete(l._id);
        pruned.lessons++;
      }
    for (const w of await ctx.db.query("words").collect())
      if (!liveWordKeys.has(w.lessonKey + "||" + w.pt)) {
        await ctx.db.delete(w._id);
        pruned.words++;
      }
    for (const s of await ctx.db.query("crossSentences").collect())
      if (!liveSentenceKeys.has(s.sentenceKey)) {
        await ctx.db.delete(s._id);
        pruned.crossSentences++;
      }
    for (const s of await ctx.db.query("topicSentences").collect())
      if (!liveTopicSentenceKeys.has(s.sentenceKey)) {
        await ctx.db.delete(s._id);
        pruned.topicSentences++;
      }

    return {
      topics: topicCount,
      lessons: lessonCount,
      words: wordCount,
      crossSentences: CROSS_SENTENCES.length,
      topicSentences: TOPIC_SENTENCES.length,
      pruned,
    };
  },
});

// ─── LOCAL / WORKTREE-ONLY: dev-аккаунт ──────────────────────────────────────
// Свежий локальный Convex-деплой (создаётся на каждый worktree через
// `npm run wt:setup`) пуст и без auth-env, а публичная регистрация выключена
// (convex/auth.ts, SIGNUP_ENABLED) — значит залогиниться нечем. `seedLocal`
// создаёт готовый dev-логин ПЛЮС заливает контент, чтобы worktree сразу был
// кликабелен. НИКОГДА не запускать на облачном dev/prod.
//
// Многослойная защита держит это вне облака:
//   1. Вызыватель (`scripts/wt-seed.mjs`) работает только в linked-worktree И
//      отказывается сеять, если выбранный CONVEX_DEPLOYMENT не `local:`/`anonymous:`.
//   2. Сам `seedLocal` отказывается, если CONVEX_CLOUD_URL (системная переменная,
//      которой владеет бэкенд, — её нельзя подделать) указывает не на localhost,
//      ИЛИ если не выставлен явный opt-in ALLOW_DEV_SEED=1.

// Канонический dev-аккаунт. Пароль удовлетворяет политике провайдера Password
// (>= 8 символов), так что реальный вход этими данными работает.
export const DEV_EMAIL = "dev@example.com";
export const DEV_PASSWORD = "12345678q";

// CONVEX_CLOUD_URL не-локального (облачного) деплоя. Локальный бэкенд отдаёт его
// с 127.0.0.1/localhost; облако — с *.convex.cloud. `undefined` (напр. под
// convex-test) считаем локальным, так что там правит ALLOW_DEV_SEED; непарсимое
// непустое значение — не-локальным (fail safe).
function isNonLocalCloudUrl(cloudUrl: string | undefined): boolean {
  if (cloudUrl === undefined) return false;
  try {
    const { hostname } = new URL(cloudUrl);
    return hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "0.0.0.0";
  } catch {
    return true;
  }
}

// Id dev-пользователя по email (null, если ещё не создан). Обеспечивает
// идемпотентность seedLocal: существующий пользователь → не звать createAccount
// повторно (он бросает на дубликате).
export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return user?._id ?? null;
  },
});

// Залить контент + создать dev-аккаунт на ЛОКАЛЬНОМ деплое. Идемпотентно:
// контент — upsert (seedContent), аккаунт — пропускается, если уже есть.
// Action, т.к. createAccount требует ActionCtx (хеширует пароль scrypt'ом
// провайдера Password и пишет auth-таблицы); работа с БД — через internal
// query/mutation.
export const seedLocal = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    email: string;
    createdAccount: boolean;
    topics: number;
    lessons: number;
    words: number;
    crossSentences: number;
    topicSentences: number;
    pruned: { topics: number; lessons: number; words: number; crossSentences: number; topicSentences: number };
  }> => {
    // Две независимые защиты держат это вне облака. Env читаем через
    // `globalThis.process` (не голый `process`), чтобы файл тайпчекался и под
    // фронтовым tsconfig — он подтягивается туда через _generated/api.d.ts, где
    // нет node-типов. Под convex-test CONVEX_CLOUD_URL не задан → локально, и
    // правит ALLOW_DEV_SEED.
    const env =
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    if (isNonLocalCloudUrl(env.CONVEX_CLOUD_URL)) {
      throw new Error(
        `seed:seedLocal отказывается работать на не-локальном деплое (CONVEX_CLOUD_URL=${env.CONVEX_CLOUD_URL}). ` +
          "Он сеет только изолированные локальные worktree-деплои, никогда облачный dev/prod.",
      );
    }
    if (env.ALLOW_DEV_SEED !== "1") {
      throw new Error(
        "seed:seedLocal выключен на этом деплое (ALLOW_DEV_SEED != 1). " +
          "Он запускается только на локальных worktree-деплоях, поднятых `npm run wt:setup`.",
      );
    }

    // Контент (глобальный, идемпотентный upsert).
    const content = await ctx.runMutation(internal.seed.seedContent, {});

    // Dev-аккаунт (идемпотентно): существующий пользователь → не создаём заново
    // (createAccount бросает на дубликате).
    const existing = await ctx.runQuery(internal.seed.findUserByEmail, { email: DEV_EMAIL });
    let createdAccount = false;
    if (existing === null) {
      // Создаёт пользователя + хешированный пароль под провайдером "password" с
      // account id = email — ровно то, что ищет вход.
      await createAccount<DataModel>(ctx, {
        provider: "password",
        account: { id: DEV_EMAIL, secret: DEV_PASSWORD },
        profile: { email: DEV_EMAIL },
      });
      createdAccount = true;
    }

    return { email: DEV_EMAIL, createdAccount, ...content };
  },
});
