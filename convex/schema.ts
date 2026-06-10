import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Stable natural keys: topicKey ("greetings"), lessonKey ("greetings_1", == old
// lesson.id), pt (the Portuguese string). Per-user progress references
// (userId, lessonKey, pt) — never a content _id — so re-seeding content (which
// may create new _ids) never breaks accumulated progress.

export default defineSchema({
  // Convex Auth tables: users, authAccounts, authSessions, authVerifiers, ...
  ...authTables,

  // ─── Content (seeded idempotently from convex/content.ts) ─────────────────
  topics: defineTable({
    topicKey: v.string(),
    label: v.string(),
    icon: v.string(),
    order: v.number(),
  }).index("by_topicKey", ["topicKey"]),

  lessons: defineTable({
    lessonKey: v.string(),
    topicKey: v.string(),
    label: v.string(),
    order: v.number(),
    theory: v.object({
      intro: v.string(),
      tip: v.string(),
      sections: v.array(
        v.object({
          heading: v.string(),
          words: v.array(v.string()),
        }),
      ),
    }),
  }).index("by_lessonKey", ["lessonKey"]),

  words: defineTable({
    lessonKey: v.string(),
    pt: v.string(),
    ru: v.string(),
    note: v.optional(v.string()),
    order: v.number(),
  }).index("by_lessonKey_pt", ["lessonKey", "pt"]),

  crossSentences: defineTable({
    sentenceKey: v.string(),
    words: v.array(v.string()),
    answer: v.string(),
    ru: v.string(),
    required: v.array(v.string()),
    order: v.number(),
  }).index("by_sentenceKey", ["sentenceKey"]),

  // ─── Per-user progress ─────────────────────────────────────────────────────
  // One row per (user, lesson, pt); a row is only created on the FIRST answer.
  progress: defineTable({
    userId: v.id("users"),
    lessonKey: v.string(),
    pt: v.string(),
    interval: v.number(), // days
    ef: v.number(), // ease factor, >= 1.3
    due: v.number(), // ms epoch
    seen: v.number(),
    correct: v.number(),
    lastSeen: v.number(), // ms epoch
    // Staged-learning counters (optional — older rows predate them, read as 0).
    // mcCorrect: правильные выборы (MC); typeCorrect: правильные ручные вводы.
    mcCorrect: v.optional(v.number()),
    typeCorrect: v.optional(v.number()),
  })
    .index("by_user_lesson_pt", ["userId", "lessonKey", "pt"])
    .index("by_user", ["userId"]),

  theorySeen: defineTable({
    userId: v.id("users"),
    lessonKey: v.string(),
  })
    .index("by_user_lesson", ["userId", "lessonKey"])
    .index("by_user", ["userId"]),

  userStats: defineTable({
    userId: v.id("users"),
    streak: v.number(),
    // День последнего ответа. Новые значения — YYYY-MM-DD (локальный день
    // клиента либо серверный UTC-fallback); легаси-строки — toDateString()
    // («Mon Jun 09 2026»), recordAnswer парсит оба и перезаписывает новым
    // форматом при первом же сдвиге дня.
    lastDay: v.string(),
  }).index("by_user", ["userId"]),
});
