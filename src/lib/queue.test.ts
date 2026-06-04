import { describe, it, expect, vi } from "vitest";
import { buildLessonQueue, buildReviewQueue, queueCounts } from "./queue";
import { wKey } from "./srs";
import type { Course, LessonView, SrsState } from "./types";

// shuffle → identity so queue order/slicing is deterministic to assert on.
vi.mock("./shuffle", () => ({ shuffle: <T>(a: readonly T[]): T[] => [...a] }));

function srsOf(over: Partial<SrsState> = {}): SrsState {
  return {
    streak: 0,
    cards: {},
    tags: {},
    seenTheory: [],
    learnedPts: [],
    dueCountAll: 0,
    lessonStats: {},
    topicStats: {},
    ...over,
  };
}

const lesson: LessonView = {
  lessonKey: "l1",
  label: "L1",
  theory: { intro: "", tip: "", sections: [] },
  words: [
    { lessonKey: "l1", pt: "a", ru: "а" },
    { lessonKey: "l1", pt: "b", ru: "б" },
    { lessonKey: "l1", pt: "c", ru: "в" },
  ],
};
const course: Course = {
  topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [lesson] }],
  crossSentences: [],
};

describe("buildLessonQueue", () => {
  it("treats untagged words as new and fills the queue with them", () => {
    const q = buildLessonQueue(lesson, srsOf(), course);
    expect(q).toHaveLength(3);
    expect(q.every((i) => i.kind === "word")).toBe(true);
    expect(queueCounts(q).nw).toBe(3);
  });

  it("places due words first", () => {
    const q = buildLessonQueue(lesson, srsOf({ tags: { [wKey("l1", "a")]: "due" } }), course);
    expect(q[0]).toMatchObject({ kind: "word", tag: "due", word: { pt: "a" } });
  });
});

describe("buildReviewQueue", () => {
  it("excludes words from lessons whose theory was not seen", () => {
    expect(buildReviewQueue(course, srsOf())).toHaveLength(0);
  });

  it("includes due words once their lesson's theory was seen", () => {
    const srs = srsOf({
      seenTheory: ["l1"],
      tags: { [wKey("l1", "a")]: "due", [wKey("l1", "b")]: "due" },
    });
    expect(queueCounts(buildReviewQueue(course, srs)).due).toBe(2);
  });
});

describe("queueCounts", () => {
  it("counts word items by tag", () => {
    const q = buildLessonQueue(lesson, srsOf(), course);
    const c = queueCounts(q);
    expect(c.nw + c.due + c.rv).toBe(q.filter((i) => i.kind === "word").length);
  });
});
