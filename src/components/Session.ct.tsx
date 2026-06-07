import { test, expect } from "@playwright/experimental-ct-react";
import { Session } from "./Session";
import type { CardFields, Course, SessionItem } from "../lib/types";

// A new word with same-lesson distractors so the choice exercise has options.
const word = { lessonKey: "l1", pt: "olá", ru: "привет" };
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
            word,
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
const noop = () => {};

function mountSession(mount: Parameters<Parameters<typeof test>[1]>[0]["mount"], over: {
  queue: SessionItem[];
  cards?: Record<string, CardFields>;
}) {
  return mount(
    <Session
      queue={over.queue}
      course={course}
      cards={over.cards ?? {}}
      dueCountAll={0}
      nextLesson={null}
      onScore={noop}
      onRestart={noop}
      onPickLesson={noop}
      onGoReview={noop}
    />,
  );
}

// Click the correct MC option regardless of direction (pt→ru shows ru options,
// ru→pt shows pt options); the correct one carries the word's ru or pt text.
async function pickCorrect(component: Awaited<ReturnType<typeof mountSession>>) {
  const ru = component.locator(".m-opt", { hasText: word.ru });
  if ((await ru.count()) > 0) await ru.first().click();
  else await component.locator(".m-opt", { hasText: word.pt }).first().click();
}

test("a new word starts in the choice stage and re-queues until learned", async ({ mount }) => {
  const component = await mountSession(mount, { queue: [{ kind: "word", word, tag: "new" }] });

  // New word → choice exercise; mastery bar shows 0 of 1.
  await expect(component.locator(".m-q-kind")).toContainText("Выберите");
  await expect(component.locator(".m-progress-count")).toHaveText("0/1");

  // One correct choice is not mastery (need 3 choices + 3 inputs): the word
  // comes back in the SAME session — no Complete screen, bar still 0/1.
  await pickCorrect(component);
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();

  await expect(component.locator(".m-q-kind")).toContainText("Выберите");
  await expect(component.locator(".m-complete")).toHaveCount(0);
  await expect(component.locator(".m-progress-count")).toHaveText("0/1");
});

test("an already-learned word is shown once and finishes the session", async ({ mount }) => {
  // Seeded as mastered (typeCorrect ≥ 3) → not re-queued; one answer completes it.
  const cards: Record<string, CardFields> = {
    "l1||olá": {
      interval: 6,
      ef: 2.5,
      due: Date.now() + 6 * 86400000,
      seen: 6,
      correct: 6,
      mcCorrect: 3,
      typeCorrect: 3,
    },
  };
  const component = await mountSession(mount, {
    queue: [{ kind: "word", word, tag: "review" }],
    cards,
  });
  await expect(component.locator(".m-progress-count")).toHaveText("0/1");

  // Answer correctly: a learned/review word may be a choice OR a manual input.
  const kind = (await component.locator(".m-q-kind").textContent()) ?? "";
  if (kind.includes("Напишите")) {
    await component.locator(".m-input").fill(word.pt);
    await component.getByRole("button", { name: "Проверить" }).click();
  } else {
    await pickCorrect(component);
  }
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();

  // Learned word leaves rotation immediately → session is complete.
  // (.m-complete is the component root here, so assert on a descendant.)
  await expect(component.getByText("Сессия завершена!")).toBeVisible();
});
