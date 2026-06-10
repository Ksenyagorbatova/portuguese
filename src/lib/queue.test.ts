import { describe, it, expect, vi } from "vitest";
import { buildLessonQueue, buildReviewQueue, REVIEW_DUE_LIMIT } from "./queue";
import { wKey } from "./srs";
import type { Course, LessonView, SessionItem, SrsState, Stat } from "./types";

// shuffle → identity so queue order/slicing is deterministic to assert on.
vi.mock("./shuffle", () => ({ shuffle: <T>(a: readonly T[]): T[] => [...a] }));

// Local tally of queue items by badge (срочные · новые · повторения · сочетания).
function queueCounts(queue: SessionItem[]): { due: number; nw: number; rv: number; cr: number } {
  const c = { due: 0, nw: 0, rv: 0, cr: 0 };
  for (const it of queue) {
    if (it.kind === "sentence") c.cr++;
    else if (it.tag === "due") c.due++;
    else if (it.tag === "new") c.nw++;
    else if (it.tag === "review") c.rv++;
  }
  return c;
}

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

  it("includes every word of the lesson (no slice — the whole lesson is drilled)", () => {
    const big: LessonView = {
      ...lesson,
      lessonKey: "lb",
      words: Array.from({ length: 10 }, (_, i) => ({ lessonKey: "lb", pt: `w${i}`, ru: `п${i}` })),
    };
    const bigCourse: Course = {
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [big] }],
      crossSentences: [],
    };
    const q = buildLessonQueue(big, srsOf(), bigCourse);
    expect(q).toHaveLength(10);
    expect(queueCounts(q).nw).toBe(10);
  });

  it("orders due words ahead of the rest while still including all of them", () => {
    const mixed: LessonView = {
      ...lesson,
      lessonKey: "lm",
      words: ["a", "b", "c", "d"].map((pt) => ({ lessonKey: "lm", pt, ru: pt })),
    };
    const mixedCourse: Course = {
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [mixed] }],
      crossSentences: [],
    };
    const srs = srsOf({
      tags: { [wKey("lm", "c")]: "due", [wKey("lm", "a")]: "learned" },
    });
    const q = buildLessonQueue(mixed, srs, mixedCourse);
    expect(q).toHaveLength(4); // all four words present
    expect(q[0]).toMatchObject({ kind: "word", tag: "due", word: { pt: "c" } });
    const c = queueCounts(q);
    expect(c.due).toBe(1);
    expect(c.nw).toBe(2); // b, d untagged → new
    expect(c.rv).toBe(1); // a learned → review badge
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

  it("caps the due words at REVIEW_DUE_LIMIT (the review button shows «N из M»)", () => {
    const many: LessonView = {
      ...lesson,
      lessonKey: "ld",
      words: Array.from({ length: REVIEW_DUE_LIMIT + 5 }, (_, i) => ({
        lessonKey: "ld",
        pt: `w${i}`,
        ru: `п${i}`,
      })),
    };
    const manyCourse: Course = {
      topics: [{ topicKey: "t", label: "T", icon: "x", lessons: [many] }],
      crossSentences: [],
    };
    const srs = srsOf({
      seenTheory: ["ld"],
      tags: Object.fromEntries(many.words.map((w) => [wKey("ld", w.pt), "due"] as const)),
    });
    expect(queueCounts(buildReviewQueue(manyCourse, srs)).due).toBe(REVIEW_DUE_LIMIT);
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

  // Дубль pt в двух темах (farmácia: city_1 и body_2; olho/cabelo аналогично):
  // слово считается готовым, когда готова ХОТЯ БЫ ОДНА из его тем — иначе
  // добавление дубля молча переносило бы гейт на последнюю тему по порядку.
  it("treats a duplicated word as ready when ANY of its topics is ready", () => {
    const lessonA: LessonView = {
      lessonKey: "a1",
      label: "A1",
      theory: { intro: "", tip: "", sections: [] },
      words: [
        { lessonKey: "a1", pt: "x", ru: "х" },
        { lessonKey: "a1", pt: "y", ru: "у" },
      ],
    };
    const lessonB: LessonView = {
      lessonKey: "b1",
      label: "B1",
      theory: { intro: "", tip: "", sections: [] },
      words: [
        { lessonKey: "b1", pt: "x", ru: "х" }, // дубль x во второй теме
        { lessonKey: "b1", pt: "z", ru: "з" },
      ],
    };
    const dupCourse: Course = {
      topics: [
        { topicKey: "tA", label: "A", icon: "x", lessons: [lessonA] },
        { topicKey: "tB", label: "B", icon: "x", lessons: [lessonB] },
      ],
      crossSentences: [
        { sentenceKey: "cs-dup", words: ["X"], answer: "X", ru: "—", required: ["x"] },
      ],
    };
    // Тема A освоена полностью, тема B не начата: гейт должен открыться по A
    // (старый last-wins смотрел только на B и прятал предложение).
    const srs = srsOf({
      learnedPts: ["x", "y"],
      topicStats: {
        tA: { total: 2, seen: 2, learned: 2, due: 0 },
        tB: { total: 2, seen: 0, learned: 0, due: 0 },
      },
    });
    const q = buildLessonQueue(lessonA, srs, dupCourse);
    expect(q.filter((i) => i.kind === "sentence")).toHaveLength(1);
  });
});
