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
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 });
    const second = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 });
    expect(second.card.interval).toBe(6);
  });

  it("resets interval to 1 on a wrong answer without raising `correct`", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 });
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 });
    const wrong = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 0 });
    expect(wrong.card.interval).toBe(1);
    expect(wrong.card.seen).toBe(3);
    expect(wrong.card.correct).toBe(2);
  });

  it("keeps the ease factor at or above the 1.3 floor", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
    let res!: Awaited<ReturnType<typeof as.mutation>>;
    for (let i = 0; i < 8; i++) {
      res = await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 0 });
    }
    expect(res.card.ef).toBeGreaterThanOrEqual(1.3);
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 }),
    ).rejects.toThrow();
  });
});

describe("getSrsState", () => {
  it("returns null when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.progress.getSrsState, {})).toBeNull();
  });

  it("classifies a mastered word as learned and tallies lesson stats", async () => {
    const t = convexTest(schema, modules);
    const { as } = await asUser(t);
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

    // Before answering: counted in total, not yet seen.
    let srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].total).toBe(1);
    expect(srs!.lessonStats["l1"].seen).toBe(0);

    // Two perfect answers → mastered (seen ≥ 2, ratio ≥ 0.6); due is 6 days out.
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 });
    await as.mutation(api.progress.recordAnswer, { lessonKey: "l1", pt: "a", quality: 2 });

    srs = await as.query(api.progress.getSrsState, {});
    expect(srs!.lessonStats["l1"].seen).toBe(1);
    expect(srs!.lessonStats["l1"].learned).toBe(1);
    expect(srs!.learnedPts).toContain("a");
    expect(srs!.dueCountAll).toBe(0);
    expect(srs!.tags.find((x) => x.pt === "a")?.tag).toBe("learned");
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
