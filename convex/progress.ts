import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// ─── SM-2 helpers (ported 1:1 from the original updateCard/isDue/isLearned) ───
type CardFields = {
  interval: number;
  ef: number;
  due: number;
  seen: number;
  correct: number;
  lastSeen: number;
};
const DEFAULT_CARD: CardFields = { interval: 0, ef: 2.5, due: 0, seen: 0, correct: 0, lastSeen: 0 };

function isLearned(c: CardFields): boolean {
  return c.seen >= 2 && c.correct / Math.max(c.seen, 1) >= 0.6;
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
  },
  handler: async (ctx, { lessonKey, pt, quality }) => {
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
        }
      : { ...DEFAULT_CARD };

    const seen = c.seen + 1;
    const correct = c.correct + (quality >= 1 ? 1 : 0);
    const q = quality === 2 ? 5 : quality === 1 ? 3 : 1;
    const ef = Math.max(1.3, c.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    let interval: number;
    if (q < 2) interval = 1;
    else if (c.interval === 0) interval = 1;
    else if (c.interval === 1) interval = 6;
    else interval = Math.round(c.interval * ef);
    const due = now + interval * 86400000;

    const card: CardFields = { interval, ef, due, seen, correct, lastSeen: now };
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
