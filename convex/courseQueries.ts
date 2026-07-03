import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// getCourse — returns the entire course content tree (was the TOPICS +
// CROSS_SENTENCES constants in the original HTML). Identical for every user,
// so it is fetched once and cached. ~20 topics / ~40 lessons / ~430 words /
// ~55 sentences ≈ 550 docs — well within Convex query limits, no pagination.
// Auth-gated like getSrsState: незалогиненному содержимое курса не отдаём
// (null → клиентский Shell показывает Splash при любом falsy значении).
export const getCourse = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [topics, lessons, words, crossSentences] = await Promise.all([
      ctx.db.query("topics").collect(),
      ctx.db.query("lessons").collect(),
      ctx.db.query("words").collect(),
      ctx.db.query("crossSentences").collect(),
    ]);

    // Group children, then sort each group by its captured `order`.
    const lessonsByTopic = new Map<string, typeof lessons>();
    for (const l of lessons) {
      const arr = lessonsByTopic.get(l.topicKey);
      if (arr) arr.push(l);
      else lessonsByTopic.set(l.topicKey, [l]);
    }
    const wordsByLesson = new Map<string, typeof words>();
    for (const w of words) {
      const arr = wordsByLesson.get(w.lessonKey);
      if (arr) arr.push(w);
      else wordsByLesson.set(w.lessonKey, [w]);
    }

    const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

    return {
      topics: [...topics].sort(byOrder).map((t) => ({
        topicKey: t.topicKey,
        label: t.label,
        icon: t.icon,
        lessons: (lessonsByTopic.get(t.topicKey) ?? []).sort(byOrder).map((l) => ({
          lessonKey: l.lessonKey,
          label: l.label,
          theory: l.theory,
          words: (wordsByLesson.get(l.lessonKey) ?? []).sort(byOrder).map((w) => ({
            lessonKey: w.lessonKey,
            pt: w.pt,
            ru: w.ru,
            note: w.note,
          })),
        })),
      })),
      crossSentences: [...crossSentences].sort(byOrder).map((s) => ({
        sentenceKey: s.sentenceKey,
        words: s.words,
        answer: s.answer,
        ru: s.ru,
        required: s.required,
      })),
    };
  },
});
