import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// ─── SM-2 helpers (ported from the original updateCard/isDue) ────────────────
type CardFields = {
  interval: number;
  ef: number;
  due: number;
  seen: number;
  correct: number;
  lastSeen: number;
  mcCorrect: number; // правильные выборы (MC) — этап «выбор»
  typeCorrect: number; // правильные ручные вводы (Type) — этап «ввод»
};
const DEFAULT_CARD: CardFields = {
  interval: 0,
  ef: 2.5,
  due: 0,
  seen: 0,
  correct: 0,
  lastSeen: 0,
  mcCorrect: 0,
  typeCorrect: 0,
};

// Staged-learning thresholds. KEEP IN SYNC with MC_TARGET/TYPE_TARGET in
// src/lib/learning.ts (Convex bundles separately from src/, so the constants
// are duplicated).
const MC_TARGET = 3; // правильных выборов (узнавание)
const TYPE_TARGET = 3; // правильных ручных вводов (воспроизведение)

// Потолок интервала SM-2 (дн.). Чистый SM-2 интервал не ограничивает, но для
// тренажёра A0–A1 даже хорошо знакомое слово полезно показывать хотя бы раз в
// ~4 месяца (иначе забывается; «вечного выпуска» слова из ротации нет — самое
// «выученное» состояние learned всё равно всплывает как due по расписанию), а
// без потолка лейбл «следующий повтор» уходит в годы и выглядит сломанным.
// 120 дн ≈ «через 4 месяца» — верхняя человеческая граница подписи (см.
// nextDueLabel).
const MAX_INTERVAL = 120;

// Слово выучено, когда набраны И узнавание (MC_TARGET выборов), И
// воспроизведение (TYPE_TARGET ручных вводов). Счётчики только растут, так что
// классификация монотонна; старые «выученные» строки уже имеют mc≥3 (их type
// рос только после фазы выбора), поэтому правило их не разучивает.
function isLearned(c: CardFields): boolean {
  return c.mcCorrect >= MC_TARGET && c.typeCorrect >= TYPE_TARGET;
}

// Per-word classification tag (server-authoritative, uses the frozen Date.now()):
//   new      — never answered (no progress row)
//   due      — answered and due for review now
//   learned  — answered, mastered, not yet due
//   ongoing  — answered, not yet mastered, not yet due
export type Tag = "new" | "due" | "learned" | "ongoing";

const wKey = (lessonKey: string, pt: string) => lessonKey + "||" + pt;

// ─── getSrsState ──────────────────────────────────────────────────────────────
// One reactive batch query feeding the whole dashboard. Replaces loadSRS,
// lessonStats, topicStats, countAllDue, hasSeenTheory, getAllLearnedPts and the
// due/new/review classification. The client uses `tags` + `learnedPts` to build
// session queues (shuffle/slice/inject happen client-side).
export const getSrsState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const now = Date.now();

    const [words, lessons, progressRows, theoryRows, statsRow] = await Promise.all([
      ctx.db.query("words").collect(),
      ctx.db.query("lessons").collect(),
      ctx.db.query("progress").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("theorySeen").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("userStats").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
    ]);

    const cardByKey = new Map<string, Doc<"progress">>();
    for (const p of progressRows) cardByKey.set(wKey(p.lessonKey, p.pt), p);

    // Returned as ARRAYS, not Record keyed by `${lessonKey}||${pt}` — `pt` holds
    // non-ASCII accents (á, ã, ç…) and Convex forbids non-ASCII in object field
    // names (values are fine). The client rebuilds the lookup maps (adaptSrs).
    const cards: Array<{ lessonKey: string; pt: string } & CardFields> = [];
    const tags: Array<{ lessonKey: string; pt: string; tag: Tag }> = [];
    const learnedPts = new Set<string>();

    type Stat = { total: number; seen: number; learned: number; due: number };
    const lessonStats: Record<string, Stat> = {};
    for (const l of lessons) lessonStats[l.lessonKey] = { total: 0, seen: 0, learned: 0, due: 0 };

    let dueCountAll = 0;

    for (const w of words) {
      const key = wKey(w.lessonKey, w.pt);
      const ls = lessonStats[w.lessonKey] ?? (lessonStats[w.lessonKey] = { total: 0, seen: 0, learned: 0, due: 0 });
      ls.total++;
      const c = cardByKey.get(key);
      if (!c || c.seen === 0) continue; // 'new' — client defaults missing tags to "new"
      const card: CardFields = {
        interval: c.interval, ef: c.ef, due: c.due,
        seen: c.seen, correct: c.correct, lastSeen: c.lastSeen,
        mcCorrect: c.mcCorrect ?? 0, typeCorrect: c.typeCorrect ?? 0,
      };
      cards.push({ lessonKey: w.lessonKey, pt: w.pt, ...card });
      ls.seen++;
      const learned = isLearned(card);
      const due = card.due <= now;
      if (learned) {
        ls.learned++;
        learnedPts.add(w.pt);
      }
      let tag: Tag;
      if (due) {
        ls.due++;
        dueCountAll++;
        tag = "due";
      } else {
        tag = learned ? "learned" : "ongoing";
      }
      tags.push({ lessonKey: w.lessonKey, pt: w.pt, tag });
    }

    const topicStats: Record<string, Stat> = {};
    for (const l of lessons) {
      const ts = topicStats[l.topicKey] ?? (topicStats[l.topicKey] = { total: 0, seen: 0, learned: 0, due: 0 });
      const ls = lessonStats[l.lessonKey];
      if (ls) {
        ts.total += ls.total;
        ts.seen += ls.seen;
        ts.learned += ls.learned;
        ts.due += ls.due;
      }
    }

    return {
      streak: statsRow?.streak ?? 0,
      cards,
      tags,
      seenTheory: theoryRows.map((t) => t.lessonKey),
      learnedPts: [...learnedPts],
      dueCountAll,
      lessonStats,
      topicStats,
    };
  },
});

// ─── recordAnswer ───────────────────────────────────────────────────────────
// Server-authoritative SM-2. quality: 0 = wrong both tries, 1 = right on 2nd,
// 2 = right on 1st try (same encoding as the original updateCard). Also bumps
// the daily streak (ported touchStreak). Returns the updated card + streak so
// the UI can show the next-review label immediately.
export const recordAnswer = mutation({
  args: {
    lessonKey: v.string(),
    pt: v.string(),
    quality: v.union(v.literal(0), v.literal(1), v.literal(2)),
    // mode: каким упражнением отвечали — определяет, какой счётчик этапа растёт.
    mode: v.union(v.literal("mc"), v.literal("type")),
  },
  handler: async (ctx, { lessonKey, pt, quality, mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();

    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user_lesson_pt", (q) =>
        q.eq("userId", userId).eq("lessonKey", lessonKey).eq("pt", pt),
      )
      .unique();

    const c: CardFields = existing
      ? {
          interval: existing.interval, ef: existing.ef, due: existing.due,
          seen: existing.seen, correct: existing.correct, lastSeen: existing.lastSeen,
          mcCorrect: existing.mcCorrect ?? 0, typeCorrect: existing.typeCorrect ?? 0,
        }
      : { ...DEFAULT_CARD };

    const seen = c.seen + 1;
    const right = quality >= 1;
    const correct = c.correct + (right ? 1 : 0);
    // Этапные счётчики растут только при верном ответе соответствующего типа.
    const mcCorrect = c.mcCorrect + (right && mode === "mc" ? 1 : 0);
    const typeCorrect = c.typeCorrect + (right && mode === "type" ? 1 : 0);

    const DAY = 86400000;
    // SM-2-расписание двигаем ТОЛЬКО на «событие повторения»: слово выучивается
    // этим ответом (выпуск) ИЛИ повторяется уже выученным И реально наступил
    // повтор (due<=now). Иначе интервал умножался бы на ef по ~6 раз за сессию
    // (баг «следующий повтор: 4131 дн»), а ранняя практика выученного слова не
    // должна сдвигать его расписание.
    const wasLearned = isLearned(c);
    const nowLearned = isLearned({ ...c, mcCorrect, typeCorrect });
    const graduating = !wasLearned && nowLearned;
    const dueReview = wasLearned && c.due <= now;

    let { interval, ef, due } = c;
    if (graduating || dueReview) {
      const q = quality === 2 ? 5 : quality === 1 ? 3 : 1;
      ef = Math.max(1.3, c.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      if (q < 2) interval = 1;
      else if (c.interval === 0) interval = 1;
      else if (c.interval === 1) interval = 6;
      else interval = Math.round(c.interval * ef);
      interval = Math.min(interval, MAX_INTERVAL);
      due = now + interval * DAY;
    } else if (!nowLearned) {
      // Слово ещё осваивается — короткий фиксированный шаг обучения (через
      // день), БЕЗ умножения интервала: так оно классифицируется как «ongoing»
      // (в работе), а не «due», и не застревает на due=0.
      due = now + DAY;
    }
    // else: ранняя практика уже выученного, но ещё не due-слова — расписание
    // (interval/ef/due) не трогаем, повтор ещё не наступил.

    const card: CardFields = {
      interval, ef, due, seen, correct, lastSeen: now, mcCorrect, typeCorrect,
    };
    if (existing) await ctx.db.patch(existing._id, card);
    else await ctx.db.insert("progress", { userId, lessonKey, pt, ...card });

    // streak (ported touchStreak)
    const today = new Date(now).toDateString();
    const statsRow = await ctx.db
      .query("userStats")
      .withIndex("by_user", (qq) => qq.eq("userId", userId))
      .unique();
    let streak: number;
    if (!statsRow) {
      streak = 1;
      await ctx.db.insert("userStats", { userId, streak, lastDay: today });
    } else if (statsRow.lastDay !== today) {
      streak = statsRow.streak + 1;
      await ctx.db.patch(statsRow._id, { streak, lastDay: today });
    } else {
      streak = statsRow.streak;
    }

    return { card, streak };
  },
});

// ─── markTheorySeen ─────────────────────────────────────────────────────────
export const markTheorySeen = mutation({
  args: { lessonKey: v.string() },
  handler: async (ctx, { lessonKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("theorySeen")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonKey", lessonKey))
      .unique();
    if (!existing) await ctx.db.insert("theorySeen", { userId, lessonKey });
    return null;
  },
});

// ─── reclampSchedules (одноразовая миграция данных) ──────────────────────────
// Легаси-строки `progress`, записанные до фикса инфляции интервала SM-2
// (interval умножался на ef на КАЖДЫЙ ответ, без потолка), несут раздутые
// interval/due — отсюда «следующий повтор: через 455 дн». Текущий планировщик
// НЕ переписывает расписание выученного, ещё не наступившего (due>now) слова при
// досрочной практике, поэтому такие значения заморожены до (далёкой) даты
// повтора. Эта миграция возвращает каждую строку под MAX_INTERVAL. Идемпотентна:
// повторный запуск — no-op. Запуск вручную (dev и, с --prod, на проде):
//   npx convex run progress:reclampSchedules
export const reclampSchedules = internalMutation({
  args: {},
  handler: async (ctx) => {
    const DAY = 86400000;
    const rows = await ctx.db.query("progress").collect();
    let fixed = 0;
    for (const r of rows) {
      const interval = Math.min(r.interval, MAX_INTERVAL);
      // due не может стоять дальше, чем обрезанный интервал от последнего повтора.
      const due = Math.min(r.due, r.lastSeen + interval * DAY);
      if (interval !== r.interval || due !== r.due) {
        await ctx.db.patch(r._id, { interval, due });
        fixed++;
      }
    }
    return { scanned: rows.length, fixed };
  },
});
