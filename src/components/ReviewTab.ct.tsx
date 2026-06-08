import { test, expect } from "@playwright/experimental-ct-react";
import { ReviewTab } from "./ReviewTab";
import type { Course, SrsState } from "../lib/types";

// ReviewTab is pure (Icon + ProgressRing, no Convex hooks), so it mounts as-is.

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

const emptySrs: SrsState = {
  streak: 0,
  cards: {},
  tags: {},
  seenTheory: [],
  learnedPts: [],
  dueCountAll: 0,
  lessonStats: {},
  topicStats: {},
};

test("hero uses «просмотрено слов» / «выучено» (not the old «изучено» / «усвоено»)", async ({
  mount,
}) => {
  const c = await mount(
    <ReviewTab course={course} srs={emptySrs} onStart={() => {}} onGoTopics={() => {}} />,
  );
  await expect(c.locator(".m-ring-cap")).toHaveText("выучено");
  await expect(c).toContainText("просмотрено слов");
  await expect(c).not.toContainText("усвоено");
  await expect(c).not.toContainText("изучено слов");
});

test("empty state: CTA «Открыть темы» is enabled and routes to Темы, not Start", async ({
  mount,
}) => {
  let wentTopics = false;
  let started = false;
  const c = await mount(
    <ReviewTab
      course={course}
      srs={emptySrs}
      onStart={() => (started = true)}
      onGoTopics={() => (wentTopics = true)}
    />,
  );
  const btn = c.getByRole("button", { name: "Открыть темы" });
  await expect(btn).toBeEnabled();
  await btn.click();
  expect(wentTopics).toBe(true);
  expect(started).toBe(false);
});
