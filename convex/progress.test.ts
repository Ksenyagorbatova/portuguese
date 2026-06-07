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

describe("recordAnswer (SM-2)", () => {
  it("first perfect answer sets interval 1, seen/correct 1 and streak 1", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await asUser(t);

    const res = await as.mutation(api.progress.recordAnswer, {
      lessonKey: "l1",
      pt: "olá",
      quality: 2,
      mode: "mc",
    });
    expect(res.card.interval).toBe(1);
    expect(res.card.seen).toBe(1);
    expect(res.card.correct).toBe(1);
    expect(res.streak).toBe(1);

    // Persisted under the natural key (userId, lessonKey, pt).
    const row = await t.run((ctx) =>
      ctx.db
        .query("progress")
        .withIndex("by_user_lesson_pt", (q) =>
          q.eq("userId", userId).eq("lessonKey", "l1").eq("pt", "olá"),
        )
        .unique(),
    );
    expect(row?.seen).toBe(1);
  });

  it("walks the interval ladder 1 → 6 on consecutive perfect answers", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    const second = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    expect(second.card.interval).toBe(6);
  });

  it("resets interval to 1 on a wrong answer without raising `correct`", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    const wrong = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 0, mode: "mc" });
    expect(wrong.card.interval).toBe(1);
    expect(wrong.card.seen).toBe(3);
    expect(wrong.card.correct).toBe(2);
  });

  it("keeps the ease factor at or above the 1.3 floor", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < 8; i++) {
      res = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 0, mode: "mc" });
    }
    expect(res.card.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" }),
    ).rejects.toThrow();
  });
});

describe("staged-learning counters", () => {
  it("grows mcCorrect on correct MC answers and typeCorrect on correct Type answers", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    const a = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    expect(a.card.mcCorrect).toBe(1);
    expect(a.card.typeCorrect).toBe(0);
    const b = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 1, mode: "type" });
    expect(b.card.mcCorrect).toBe(1);
    expect(b.card.typeCorrect).toBe(1);
  });

  it("does not grow stage counters on a wrong answer", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    const wrong = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 0, mode: "type" });
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

  it("marks a word learned only after TYPE_TARGET (3) correct manual inputs", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await seedLesson(t);

    // Three correct MC answers do NOT make it learned (choice ≠ mastery).
    for (let i = 0; i < 3; i++)
      await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "mc" });
    let srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);
    expect(srs!.learnedPts).not.toContain("a");

    // Two correct Type answers — still not learned (need 3).
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "type" });
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "type" });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(0);

    // Third correct Type answer → learned.
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2, mode: "type" });
    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].learned).toBe(1);
    expect(srs!.learnedPts).toContain("a");
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("learned");
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
