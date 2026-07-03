import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

// Авторизованный контекст: getAuthUserId парсит subject как `${userId}|session`.
async function asUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return t.withIdentity({ subject: `${userId}|session` });
}

describe("getCourse", () => {
  it("returns null when unauthenticated (как getSrsState)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedContent, {});
    expect(await t.query(api.courseQueries.getCourse, {})).toBeNull();
  });

  it("returns an empty tree when nothing is seeded", async () => {
    const t = convexTest(schema, modules);
    const as = await asUser(t);
    const course = await as.query(api.courseQueries.getCourse, {});
    expect(course!.topics).toEqual([]);
    expect(course!.crossSentences).toEqual([]);
  });

  it("returns the seeded tree with nested lessons and words", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedContent, {});
    const as = await asUser(t);

    const course = await as.query(api.courseQueries.getCourse, {});
    expect(course!.topics.length).toBeGreaterThan(0);

    const firstTopic = course!.topics[0];
    expect(firstTopic).toHaveProperty("topicKey");
    expect(firstTopic.lessons.length).toBeGreaterThan(0);
    expect(firstTopic.lessons[0].words.length).toBeGreaterThan(0);

    // topics are sorted by their captured order (ascending, gap-free here).
    const seedReport = await t.run(async (ctx) => {
      const topics = await ctx.db.query("topics").collect();
      return topics.length;
    });
    expect(course!.topics).toHaveLength(seedReport);
  });

  it("attaches per-topic sentences (раздел «Построение предложений») to each topic", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedContent, {});
    const as = await asUser(t);

    const course = await as.query(api.courseQueries.getCourse, {});
    const greetings = course!.topics.find((tp) => tp.topicKey === "greetings");
    expect(greetings).toBeTruthy();
    // Пилот-темы несут предложения; каждое — своей темы и с полем blank.
    expect(greetings!.sentences.length).toBeGreaterThan(0);
    expect(greetings!.sentences.every((s) => s.topicKey === "greetings")).toBe(true);
    expect(greetings!.sentences[0]).toHaveProperty("blank");
    expect(greetings!.sentences[0]).toHaveProperty("answer");
    // Каждая тема курса несёт массив sentences (возможно пустой).
    expect(course!.topics.every((tp) => Array.isArray(tp.sentences))).toBe(true);
  });
});
