import { describe, it, expect, vi } from "vitest";
import { allWordsOf, getWrong } from "./wrongOptions";
import type { Course } from "./types";

// Make distractor selection deterministic: shuffle() becomes identity.
vi.mock("./shuffle", () => ({ shuffle: <T>(a: readonly T[]): T[] => [...a] }));

const course: Course = {
  topics: [
    {
      topicKey: "t",
      label: "T",
      icon: "x",
      lessons: [
        {
          lessonKey: "l1",
          label: "L1",
          theory: { intro: "", tip: "", sections: [] },
          words: [
            { lessonKey: "l1", pt: "olá", ru: "привет" },
            { lessonKey: "l1", pt: "adeus", ru: "пока" },
            { lessonKey: "l1", pt: "sim", ru: "да" },
            { lessonKey: "l1", pt: "não", ru: "нет" },
          ],
        },
        {
          // A second lesson — its words must NOT appear as distractors for l1.
          lessonKey: "l2",
          label: "L2",
          theory: { intro: "", tip: "", sections: [] },
          words: [
            { lessonKey: "l2", pt: "um", ru: "один" },
            { lessonKey: "l2", pt: "dois", ru: "два" },
            { lessonKey: "l2", pt: "três", ru: "три" },
          ],
        },
      ],
    },
  ],
  crossSentences: [],
};

describe("allWordsOf", () => {
  it("flattens every word across topics and lessons", () => {
    expect(allWordsOf(course).map((w) => w.pt)).toEqual([
      "olá", "adeus", "sim", "não", "um", "dois", "três",
    ]);
  });
});

describe("getWrong", () => {
  const correct = { lessonKey: "l1", pt: "olá", ru: "привет" };

  it("draws distractors only from the correct word's own lesson", () => {
    const wrong = getWrong(course, correct, 3);
    expect(wrong).toHaveLength(3);
    expect(wrong.every((w) => w.lessonKey === "l1")).toBe(true);
    expect(wrong.map((w) => w.pt)).toEqual(["adeus", "sim", "não"]);
  });

  it("excludes the correct word (by pt and ru)", () => {
    const wrong = getWrong(course, correct, 2);
    expect(wrong).toHaveLength(2);
    expect(wrong.every((w) => w.pt !== "olá" && w.ru !== "привет")).toBe(true);
  });

  it("tops up from other lessons when the lesson is too small", () => {
    // l2 has only 3 words → 2 distractors after excluding the correct one;
    // the 3rd must be topped up from the rest of the course (l1).
    const small = { lessonKey: "l2", pt: "um", ru: "один" };
    const wrong = getWrong(course, small, 3);
    expect(wrong).toHaveLength(3);
    expect(wrong.filter((w) => w.lessonKey === "l2")).toHaveLength(2);
    expect(wrong.filter((w) => w.lessonKey === "l1")).toHaveLength(1);
    expect(wrong.every((w) => w.pt !== "um")).toBe(true);
  });

  it("never returns more than the available pool", () => {
    expect(getWrong(course, correct, 99)).toHaveLength(6);
  });
});
