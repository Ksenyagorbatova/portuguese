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
      onExit={noop}
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

// Answer the current exercise correctly — it may be a choice OR a manual input,
// since the exercise type is now randomized within the session.
async function answerCorrect(component: Awaited<ReturnType<typeof mountSession>>) {
  const kind = (await component.locator(".m-q-kind").textContent()) ?? "";
  if (kind.includes("Напишите")) {
    await component.locator(".m-input").fill(word.pt);
    await component.getByRole("button", { name: "Проверить" }).click();
  } else {
    await pickCorrect(component);
  }
}

test("a not-yet-learned word re-queues within the same session", async ({ mount }) => {
  const component = await mountSession(mount, { queue: [{ kind: "word", word, tag: "new" }] });

  // Counter = position in session. One word, first card → 1/1.
  await expect(component.locator(".m-progress-count")).toHaveText("1/1");

  // One correct answer is not mastery (needs 3 choices + 3 inputs): the word is
  // re-queued in the SAME session — no Complete screen. Position advances (the
  // requeue grew the queue → 2/2).
  await answerCorrect(component);
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();

  await expect(component.locator(".m-complete")).toHaveCount(0);
  await expect(component.locator(".m-progress-count")).toHaveText("2/2");
  await expect(component.locator(".m-card")).toBeVisible();
});

test("the progress bar exposes progressbar semantics", async ({ mount }) => {
  const component = await mountSession(mount, { queue: [{ kind: "word", word, tag: "new" }] });
  const bar = component.getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-label", "Позиция в сессии");
  await expect(bar).toHaveAttribute("aria-valuemin", "0");
  await expect(bar).toHaveAttribute("aria-valuemax", "1");
  await expect(bar).toHaveAttribute("aria-valuenow", "1");
});

test("the exit control bails out of the session", async ({ mount }) => {
  let exited = false;
  const component = await mount(
    <Session
      queue={[{ kind: "word", word, tag: "new" }]}
      course={course}
      cards={{}}
      dueCountAll={0}
      nextLesson={null}
      onScore={noop}
      onRestart={noop}
      onPickLesson={noop}
      onGoReview={noop}
      onExit={() => {
        exited = true;
      }}
    />,
  );
  await component.getByRole("button", { name: "Выйти из тренировки" }).click();
  expect(exited).toBe(true);
});

test("an already-learned word is shown once and finishes the session", async ({ mount }) => {
  // Seeded as mastered (both skills met) → not re-queued; one answer completes it.
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
  await expect(component.locator(".m-progress-count")).toHaveText("1/1");

  await answerCorrect(component);
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();

  // Learned word leaves rotation immediately → session is complete.
  // (.m-complete is the component root here, so assert on a descendant.)
  await expect(component.getByText("Сессия завершена!")).toBeVisible();
});

// ── П.1: «Дальше» помещается на мобильном экране без прокрутки ───────────────
// На узком высоком экране телефона разворачиваем самое высокое упражнение
// (выбор из 4 вариантов + строка SRS + фидбэк) и проверяем, что после ответа
// кнопка «Дальше» целиком во вьюпорте. Карточку считаем без хедера приложения
// (во время сессии он — единственная остающаяся «шапка»), поэтому берём высоту
// вьюпорта с запасом под него.
test.describe("compact layout keeps «Дальше» on-screen (mobile)", () => {
  test.use({ viewport: { width: 390, height: 660 } });

  test("the Next button is fully in the viewport after answering", async ({ mount }) => {
    // mc=0,type=3 → only the choice skill is owed → a multiple-choice (the
    // tallest exercise) is shown deterministically; tag «review» also renders
    // the SRS line, the worst case for height.
    const cards: Record<string, CardFields> = {
      "l1||olá": {
        interval: 6,
        ef: 2.5,
        due: Date.now() + 6 * 86400000,
        seen: 6,
        correct: 3,
        mcCorrect: 0,
        typeCorrect: 3,
      },
    };
    const component = await mountSession(mount, {
      queue: [{ kind: "word", word, tag: "review" }],
      cards,
    });
    await expect(component.locator(".m-q-kind")).toContainText("Выберите");
    await pickCorrect(component);

    const next = component.getByRole("button", { name: /Дальше|Завершить/ });
    await expect(next).toBeVisible();
    await expect(next).toBeInViewport({ ratio: 1 });
  });
});
