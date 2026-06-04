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
      ],
    },
  ],
  crossSentences: [],
};

describe("allWordsOf", () => {
  it("flattens every word across topics and lessons", () => {
    expect(allWordsOf(course).map((w) => w.pt)).toEqual(["olá", "adeus", "sim", "não"]);
  });
});

describe("getWrong", () => {
  const correct = { lessonKey: "l1", pt: "olá", ru: "привет" };

  it("excludes the correct word (by pt and ru) and returns `count` items", () => {
    const wrong = getWrong(course, correct, 2);
    expect(wrong).toHaveLength(2);
    expect(wrong.every((w) => w.pt !== "olá" && w.ru !== "привет")).toBe(true);
  });

  it("never returns more than the available pool", () => {
    expect(getWrong(course, correct, 99)).toHaveLength(3);
  });
});
