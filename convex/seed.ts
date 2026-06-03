import { internalMutation } from "./_generated/server";
import { TOPICS, CROSS_SENTENCES } from "./content";

// Idempotent content seed. Upserts by natural key (topicKey / lessonKey /
// (lessonKey,pt) / sentenceKey), so it is safe to run on every deploy:
// new entries are inserted, edited ones are patched in place, no duplicates.
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

    let ti = 0;
    for (const [topicKey, topic] of Object.entries(TOPICS)) {
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

    return {
      topics: topicCount,
      lessons: lessonCount,
      words: wordCount,
      crossSentences: CROSS_SENTENCES.length,
    };
  },
});
