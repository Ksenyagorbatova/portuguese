import { describe, it, expect, vi } from "vitest";
import { buildLessonQueue, buildReviewQueue, queueCounts } from "./queue";
import { wKey } from "./srs";
import { NEW_PER_SESSION } from "./learning";
import type { Course, LessonView, SrsState, Stat } from "./types";

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

  it("caps new words at NEW_PER_SESSION", () => {
    const big: LessonView = {
      ...lesson,
      lessonKey: "lb",
      words: Array.from({ length: 6 }, (_, i) => ({ lessonKey: "lb", pt: `w${i}`, ru: `п${i}` })),
    };
    const bigCourse: Course = {
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [big] }],
      crossSentences: [],
    };
    expect(queueCounts(buildLessonQueue(big, srsOf(), bigCourse)).nw).toBe(NEW_PER_SESSION);
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

describe("cross-sentence gate (topic ≥80% + required learned)", () => {
  const gateLesson: LessonView = {
    lessonKey: "l1",
    label: "L1",
    theory: { intro: "", tip: "", sections: [] },
    words: ["a", "b", "c", "d", "e"].map((pt) => ({ lessonKey: "l1", pt, ru: pt })),
  };
  const gateCourse: Course = {
    topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [gateLesson] }],
    crossSentences: [
      { sentenceKey: "cs1", words: ["A", "B"], answer: "A B", ru: "—", required: ["a", "b"] },
    ],
  };
  const stat = (learned: number): Record<string, Stat> => ({
    t: { total: 5, seen: 5, learned, due: 0 },
  });

  it("hides the sentence while the topic is below 80% learned", () => {
    const srs = srsOf({ learnedPts: ["a", "b"], topicStats: stat(3) }); // 60%
    expect(queueCounts(buildLessonQueue(gateLesson, srs, gateCourse)).cr).toBe(0);
  });

  it("shows the sentence once the topic hits 80% AND required words are learned", () => {
    const srs = srsOf({ learnedPts: ["a", "b"], topicStats: stat(4) }); // 80%
    expect(queueCounts(buildLessonQueue(gateLesson, srs, gateCourse)).cr).toBe(1);
  });

  it("hides the sentence if a required word is not learned, even at 80%", () => {
    const srs = srsOf({ learnedPts: ["a"], topicStats: stat(4) }); // b missing
    expect(queueCounts(buildLessonQueue(gateLesson, srs, gateCourse)).cr).toBe(0);
  });
});

describe("queueCounts", () => {
  it("counts word items by tag", () => {
    const q = buildLessonQueue(lesson, srsOf(), course);
    const c = queueCounts(q);
    expect(c.nw + c.due + c.rv).toBe(q.filter((i) => i.kind === "word").length);
  });
});
