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
      sentences: [],
    },
  ],
  crossSentences: [],
};

const srs: SrsState = {
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

const noop = () => {};

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
      onOpenSentences={noop}
    />,
  );
  // exact: строка урока теперь role="button" и содержит «Теория» в имени.
  await component.getByRole("button", { name: "Теория", exact: true }).click();
  expect(theoryArgs).toEqual(["t", "l1"]);
  expect(lessonOpened).toBe(false); // stopPropagation kept the row click from firing
});

test("lesson meta reads «N из M слов» with no stray percent near the bar", async ({ mount }) => {
  const component = await mount(
    <TopicsTab course={course} srs={srs} onOpenLesson={noop} onOpenTheory={noop} onOpenSentences={noop} />,
  );
  await expect(component.locator(".m-lesson-meta")).toContainText("0 из 1 слов");
  // The duplicate «N%» text (m-topic-pct) is gone — the bar encodes progress.
  await expect(component.locator(".m-topic-pct")).toHaveCount(0);
  await expect(component).not.toContainText("%");
});

// Пилюля «сессия ≈ 5 мин» удалена по решению владельца (вводила лишний шум в
// строку урока) — мета снова только «N из M слов» + «новая».
test("the lesson meta carries no time-estimate pill", async ({ mount }) => {
  const component = await mount(
    <TopicsTab course={course} srs={srs} onOpenLesson={noop} onOpenTheory={noop} onOpenSentences={noop} />,
  );
  await expect(component.locator(".m-pill-est")).toHaveCount(0);
  await expect(component).not.toContainText("сессия ≈");
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
      onOpenTheory={noop}
      onOpenSentences={noop}
    />,
  );
  await component.getByText("Урок 1").click();
  expect(openedLesson).toBe("l1");
});

// ── Раздел «Построение предложений» ──────────────────────────────────────────

test("the «Построение предложений» section appears when the topic has sentences and opens on click", async ({
  mount,
}) => {
  let openedTopic: string | null = null;
  const courseWithSentences: Course = {
    topics: [
      {
        ...course.topics[0],
        sentences: [
          { sentenceKey: "ts_1", topicKey: "t", words: ["A", "B"], answer: "A B", ru: "аб", blank: "A" },
        ],
      },
    ],
    crossSentences: [],
  };
  const component = await mount(
    <TopicsTab
      course={courseWithSentences}
      srs={srs}
      onOpenLesson={noop}
      onOpenTheory={noop}
      onOpenSentences={(tk) => {
        openedTopic = tk;
      }}
    />,
  );
  // Тема несёт 1 урок → раздел нумеруется как «Часть 2».
  const row = component.getByText("Часть 2 — Построение предложений");
  await expect(row).toBeVisible();
  await row.click();
  expect(openedTopic).toBe("t");
});

test("no «Построение предложений» section when the topic has no sentences", async ({ mount }) => {
  const component = await mount(
    <TopicsTab course={course} srs={srs} onOpenLesson={noop} onOpenTheory={noop} onOpenSentences={noop} />,
  );
  await expect(component).not.toContainText("Построение предложений");
});

// ── Клавиатурная доступность ─────────────────────────────────────────────────

test("Enter and Space on the focused lesson row open the lesson", async ({ mount, page }) => {
  const opened: string[] = [];
  const component = await mount(
    <TopicsTab
      course={course}
      srs={srs}
      onOpenLesson={(_tk, l) => {
        opened.push(l.lessonKey);
      }}
      onOpenTheory={noop}
      onOpenSentences={noop}
    />,
  );
  const row = component.getByRole("button", { name: /Урок 1/ });
  await row.focus();
  await page.keyboard.press("Enter");
  expect(opened).toEqual(["l1"]);

  await row.focus();
  await page.keyboard.press("Space");
  expect(opened).toEqual(["l1", "l1"]);
});

test("Enter on the nested Теория button does not also open the lesson", async ({
  mount,
  page,
}) => {
  let theoryOpened = 0;
  let lessonOpened = 0;
  const component = await mount(
    <TopicsTab
      course={course}
      srs={srs}
      onOpenLesson={() => {
        lessonOpened += 1;
      }}
      onOpenTheory={() => {
        theoryOpened += 1;
      }}
      onOpenSentences={noop}
    />,
  );
  await component.getByRole("button", { name: "Теория", exact: true }).focus();
  await page.keyboard.press("Enter");
  expect(theoryOpened).toBe(1);
  expect(lessonOpened).toBe(0);
});

test("the topic head is a real button and toggles via keyboard with aria-expanded", async ({
  mount,
}) => {
  const component = await mount(
    <TopicsTab course={course} srs={srs} onOpenLesson={noop} onOpenTheory={noop} onOpenSentences={noop} />,
  );
  const head = component.locator(".m-topic-head");
  await expect(head).toHaveRole("button");
  await expect(head).toHaveAttribute("aria-expanded", "true"); // первая тема раскрыта
  await expect(component.locator(".m-lesson")).toHaveCount(1);

  await head.press("Enter"); // фокус + Enter = нативная активация кнопки
  await expect(head).toHaveAttribute("aria-expanded", "false");
  await expect(component.locator(".m-lesson")).toHaveCount(0);
});
