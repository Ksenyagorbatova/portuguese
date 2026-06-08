import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

// Create a user row and return a context authenticated as them. getAuthUserId
// parses identity.subject as `${userId}|${sessionId}`.
async function asUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

const W = { lessonKey: "l1", pt: "a" };

type AuthCtx = Awaited<ReturnType<typeof asUser>>["as"];

// Drive a word to «learned»: MC_TARGET (3) correct choices + TYPE_TARGET (3)
// correct manual inputs. Returns the graduating answer's result. Mirrors what
// the in-session rotation produces, all within one session.
async function graduate(as: AuthCtx) {
  for (let i = 0; i < 3; i++)
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
  let res!: Awaited<ReturnType<typeof as.mutation>>;
  for (let i = 0; i < 3; i++)
    res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
  return res;
}

// Simulate time passing until the word is due (a real review only advances the
// SM-2 schedule when due<=now). Pulls every progress row's `due` into the past
// — tests here only ever have the single word "a".
async function makeDue(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("progress").collect();
    for (const row of rows) await ctx.db.patch(row._id, { due: 0 });
  });
}

describe("recordAnswer — SM-2 only advances on a review event", () => {
  it("does NOT compound the interval on in-session drilling answers", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    // 3 MC + 2 Type — pre-mastery drilling. Counters grow but the interval must
    // stay at 0 (no ladder-climbing): applying SM-2 on every rep is what blew
    // the interval up to «4131 дн». `due` is only a short learning step.
    for (let i = 0; i < 3; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    let res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(res.card.interval).toBe(0);
    res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(res.card.interval).toBe(0);
    expect(res.card.mcCorrect).toBe(3);
    expect(res.card.typeCorrect).toBe(2);
    // due is a ~1-day learning step, never an exploded value.
    expect(res.card.due).toBeLessThanOrEqual(Date.now() + 2 * 86400000);
  });

  it("the graduating answer sets interval 1 (first real review)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    const res = await graduate(as);
    expect(res.card.interval).toBe(1);
    expect(res.card.mcCorrect).toBe(3);
    expect(res.card.typeCorrect).toBe(3);
    expect(res.card.due).toBeGreaterThan(0);
  });

  it("does NOT move the schedule when a learned word is practised early (not due)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    const grad = await graduate(as); // interval 1, due ~tomorrow (future)
    // Practise it again immediately — it is NOT due yet, so the spaced schedule
    // must stay put (early practice still counts toward seen, just not SM-2).
    const early = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(early.card.interval).toBe(grad.card.interval);
    expect(early.card.due).toBe(grad.card.due);
    expect(early.card.seen).toBe(grad.card.seen + 1);
  });

  it("walks the interval ladder 1 → 6 on the next DUE review of a learned word", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await graduate(as); // interval 1, learned
    await makeDue(t); // a day passes → the word is due
    const review = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    expect(review.card.interval).toBe(6);
  });

  it("caps the interval at MAX_INTERVAL (365 дн) however many perfect reviews", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await graduate(as);
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < 10; i++) {
      await makeDue(t);
      res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    }
    expect(res.card.interval).toBe(365);
  });

  it("resets a learned word's interval to 1 on a wrong DUE review", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await graduate(as);
    await makeDue(t);
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" }); // interval 6
    await makeDue(t);
    const wrong = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
    expect(wrong.card.interval).toBe(1);
    // Still mastered — counters only grow, a single lapse doesn't unlearn it.
    expect(wrong.card.typeCorrect).toBeGreaterThanOrEqual(3);
  });

  it("keeps the ease factor at or above the 1.3 floor on repeated lapses", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await graduate(as);
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < 6; i++) {
      await makeDue(t);
      res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
    }
    expect(res.card.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("first answer bumps the daily streak to 1", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    const res = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    expect(res.streak).toBe(1);
    expect(res.card.seen).toBe(1);
    expect(res.card.correct).toBe(1);

    const row = await t.run((ctx) =>
      ctx.db
        .query("progress")
        .withIndex("by_user_lesson_pt", (q) =>
          q.eq("userId", userId).eq("lessonKey", "l1").eq("pt", "a"),
        )
        .unique(),
    );
    expect(row?.seen).toBe(1);
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" }),
    ).rejects.toThrow();
  });
});

describe("staged-learning counters", () => {
  it("grows mcCorrect on correct MC answers and typeCorrect on correct Type answers", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    const a = await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    expect(a.card.mcCorrect).toBe(1);
    expect(a.card.typeCorrect).toBe(0);
    const b = await as.mutation(api.progress.recordAnswer, { ...W, quality: 1, mode: "type" });
    expect(b.card.mcCorrect).toBe(1);
    expect(b.card.typeCorrect).toBe(1);
  });

  it("does not grow stage counters on a wrong answer", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    const wrong = await as.mutation(api.progress.recordAnswer, { ...W, quality: 0, mode: "type" });
    expect(wrong.card.mcCorrect).toBe(1);
    expect(wrong.card.typeCorrect).toBe(0);
  });
});

describe("getSrsState", () => {
  it("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.progress.getSrsState, {})).toBeNull();
  });

  async function seedLesson(t: ReturnType<typeof convexTest>) {
    await t.run(async (ctx) => {
      await ctx.db.insert("lessons", {
        lessonKey: "l1",
        topicKey: "t1",
        label: "L1",
        order: 0,
        theory: { intro: "", tip: "", sections: [] },
      });
      await ctx.db.insert("words", { lessonKey: "l1", pt: "a", ru: "а", order: 0 });
    });
  }

  it("marks a word learned only once BOTH MC and Type targets are met", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedLesson(t);

    // Three correct MC answers do NOT make it learned (recognition ≠ mastery).
    for (let i = 0; i < 3; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    let srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.learnedPts).not.toContain("a");

    // Two correct Type answers — still not learned (need 3).
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);

    // Third correct Type answer → both skills met → learned.
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(1);
    expect(srs!.learnedPts).toContain("a");
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("learned");
  });

  it("does NOT mark a word learned from Type answers alone (MC still required)", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedLesson(t);
    // Three correct Type answers but zero MC → recognition is still owed.
    for (let i = 0; i < 3; i++)
      await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.learnedPts).not.toContain("a");
  });

  it("classifies a partially-drilled word as ongoing (not due) — a learning step, not due=0", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedLesson(t);
    // A couple of correct drilling answers — seen, but not learned. The word
    // must read as «ongoing» (in-progress), NOT pile onto the urgent «due»
    // counter, and must NOT be stuck at due=0.
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "mc" });
    await as.mutation(api.progress.recordAnswer, { ...W, quality: 2, mode: "type" });
    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].seen).toBe(1);
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.lessonStats["l1"].due).toBe(0);
    expect(srs!.dueCountAll).toBe(0);
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("ongoing");
  });

  it("treats a legacy progress row (no stage counters) as not learned", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await seedLesson(t);
    // A row predating the staged-learning fields: high seen/correct, but no
    // mcCorrect/typeCorrect — must read as 0 and classify as ongoing, not learned.
    await t.run((ctx) =>
      ctx.db.insert("progress", {
        userId,
        lessonKey: "l1",
        pt: "a",
        interval: 6,
        ef: 2.5,
        due: Date.now() + 6 * 86400000,
        seen: 5,
        correct: 5,
        lastSeen: Date.now(),
      }),
    );
    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].seen).toBe(1);
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("ongoing");
  });
});

describe("markTheorySeen", () => {
  it("records a lesson's theory as seen, idempotently", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);
    await as.mutation(api.progress.markTheorySeen, { lessonKey: "l1" });
    await as.mutation(api.progress.markTheorySeen, { lessonKey: "l1" });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("theorySeen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(1);

    const srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.seenTheory).toContain("l1");
  });
});
