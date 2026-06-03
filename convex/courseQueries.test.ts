import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

describe("getCourse", () => {
  it("returns an empty tree when nothing is seeded", async () => {
    const t = convexTest(schema, modules);
    const course = await t.query(api.courseQueries.getCourse, {});
    expect(course.topics).toEqual([]);
    expect(course.crossSentences).toEqual([]);
  });

  it("returns the seeded tree with nested lessons and words", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.seedContent, {});

    const course = await t.query(api.courseQueries.getCourse, {});
    expect(course.topics.length).toBeGreaterThan(0);

    const firstTopic = course.topics[0];
    expect(firstTopic).toHaveProperty("topicKey");
    expect(firstTopic.lessons.length).toBeGreaterThan(0);
    expect(firstTopic.lessons[0].words.length).toBeGreaterThan(0);

    // topics are sorted by their captured order (ascending, gap-free here).
    const seedReport = await t.run(async (ctx) => {
      const topics = await ctx.db.query("topics").collect();
      return topics.length;
    });
    expect(course.topics).toHaveLength(seedReport);
  });
});
