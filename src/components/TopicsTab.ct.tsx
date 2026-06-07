import { test, expect } from "@playwright/experimental-ct-react";
import { TopicsTab } from "./TopicsTab";
import type { Course, SrsState } from "../lib/types";

const course: Course = {
  topics: [
    {
      topicKey: "t",
      label: "Тема",
      icon: "x",
      lessons: [
        {
          lessonKey: "l1",
          label: "Урок 1",
          theory: { intro: "", tip: "", sections: [] },
          words: [{ lessonKey: "l1", pt: "a", ru: "а" }],
        },
      ],
    },
  ],
  crossSentences: [],
};

const srs: SrsState = {
  streak: 0,
  cards: {},
  tags: {},
  seenTheory: [],
  learnedPts: [],
  dueCountAll: 0,
  lessonStats: {},
  topicStats: {},
};

test("the Теория button opens theory without starting the lesson", async ({ mount }) => {
  let theoryArgs: [string, string] | null = null;
  let lessonOpened = false;
  const component = await mount(
    <TopicsTab
      course={course}
      srs={srs}
      onOpenLesson={() => {
        lessonOpened = true;
      }}
      onOpenTheory={(tk, l) => {
        theoryArgs = [tk, l.lessonKey];
      }}
    />,
  );
  await component.getByRole("button", { name: "Теория" }).click();
  expect(theoryArgs).toEqual(["t", "l1"]);
  expect(lessonOpened).toBe(false); // stopPropagation kept the row click from firing
});

test("clicking the lesson row starts the lesson", async ({ mount }) => {
  let openedLesson: string | null = null;
  const component = await mount(
    <TopicsTab
      course={course}
      srs={srs}
      onOpenLesson={(_tk, l) => {
        openedLesson = l.lessonKey;
      }}
      onOpenTheory={() => {}}
    />,
  );
  await component.getByText("Урок 1").click();
  expect(openedLesson).toBe("l1");
});
