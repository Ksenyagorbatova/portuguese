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
      sentences: [],
    },
  ],
  crossSentences: [],
};

const emptySrs: SrsState = {
  streak: 0,
  doneToday: false,
  bestStreak: 0,
  startedAt: null,
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

// srs with words to review: lesson theory seen + N due words (dueCountAll = N).
function dueSrs(due: number): SrsState {
  return {
    ...emptySrs,
    seenTheory: ["l1"],
    dueCountAll: due,
    lessonStats: { l1: { total: 20, seen: 20, learned: 0, due } },
  };
}

test("pluralizes «к повтору»: 1 слово / 2 слова / 5 слов", async ({ mount }) => {
  const c1 = await mount(
    <ReviewTab course={course} srs={dueSrs(1)} onStart={() => {}} onGoTopics={() => {}} />,
  );
  await expect(c1).toContainText("1 слово пора повторить");
  await expect(c1.getByRole("button", { name: "Повторить (1 слово)" })).toBeVisible();

  await c1.unmount();
  const c2 = await mount(
    <ReviewTab course={course} srs={dueSrs(2)} onStart={() => {}} onGoTopics={() => {}} />,
  );
  await expect(c2).toContainText("2 слова пора повторить");
  await expect(c2.getByRole("button", { name: "Повторить (2 слова)" })).toBeVisible();

  await c2.unmount();
  const c5 = await mount(
    <ReviewTab course={course} srs={dueSrs(5)} onStart={() => {}} onGoTopics={() => {}} />,
  );
  await expect(c5).toContainText("5 слов пора повторить");
  await expect(c5.getByRole("button", { name: "Повторить (5 слов)" })).toBeVisible();
});

test("the review button is honest about the session cap: «Повторить (15 из 40)»", async ({
  mount,
}) => {
  const c = await mount(
    <ReviewTab course={course} srs={dueSrs(40)} onStart={() => {}} onGoTopics={() => {}} />,
  );
  // buildReviewQueue takes at most REVIEW_DUE_LIMIT (15) due words per session.
  await expect(c.getByRole("button", { name: "Повторить (15 из 40)" })).toBeVisible();
  await expect(c).toContainText("40 слов пора повторить");
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

// ── П.2 (рекомендации v4): прогноз повторений вместо пустого «всё сделано» ────
test("прогноз: при due=0 и выученных словах — строка-мост «… к повтору: N слов»", async ({
  mount,
}) => {
  // ≥2 календарных дня вперёд — устойчиво «не сегодня» при любом времени прогона.
  const future = Date.now() + 3 * 86400000 + 12 * 3600000;
  const srs: SrsState = {
    ...emptySrs,
    seenTheory: ["l1"],
    learnedPts: ["a"],
    dueCountAll: 0,
    lessonStats: { l1: { total: 1, seen: 1, learned: 1, due: 0 } },
    cards: {
      "l1||a": {
        interval: 3, ef: 2.5, due: future, seen: 3, correct: 3,
        lastSeen: 0, mcCorrect: 3, typeCorrect: 3,
      },
    },
  };
  const c = await mount(<ReviewTab course={course} srs={srs} onStart={() => {}} onGoTopics={() => {}} />);
  const line = c.locator(".m-forecast");
  await expect(line).toBeVisible();
  await expect(line).toContainText("к повтору:");
  await expect(line).toContainText("1 слово");
});

test("прогноза нет, когда есть срочные повторы (due>0)", async ({ mount }) => {
  const c = await mount(<ReviewTab course={course} srs={dueSrs(3)} onStart={() => {}} onGoTopics={() => {}} />);
  await expect(c.locator(".m-forecast")).toHaveCount(0);
});
