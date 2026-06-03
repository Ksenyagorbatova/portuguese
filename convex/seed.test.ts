import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";

// Load all Convex modules for the in-memory backend (includes _generated;
// excludes the test files themselves).
const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

describe("seedContent", () => {
  it("seeds the course and is idempotent (no duplicates on re-run)", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.seed.seedContent, {});
    const second = await t.mutation(internal.seed.seedContent, {});

    // Same reported counts both times.
    expect(second).toEqual(first);
    expect(first.topics).toBeGreaterThan(0);
    expect(first.words).toBeGreaterThan(0);

    // DB holds exactly the reported number of rows — upsert, not duplicate.
    const topics = await t.run((ctx) => ctx.db.query("topics").collect());
    const words = await t.run((ctx) => ctx.db.query("words").collect());
    const sentences = await t.run((ctx) => ctx.db.query("crossSentences").collect());
    expect(topics).toHaveLength(first.topics);
    expect(words).toHaveLength(first.words);
    expect(sentences).toHaveLength(first.crossSentences);
  });
});
