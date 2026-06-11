import { test, expect } from "@playwright/experimental-ct-react";
import type { ComponentFixtures, MountResult } from "@playwright/experimental-ct-react";
import { Session } from "./Session";
import type { CardFields, Course, SessionItem, WordView } from "../lib/types";

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

type CourseStats = {
  wordsTotal: number;
  topicsTotal: number;
  days: number | null;
  bestStreak: number;
};

function mountSession(
  mount: ComponentFixtures["mount"],
  over: {
    queue: SessionItem[];
    cards?: Record<string, CardFields>;
    onRetryMistakes?: (words: WordView[]) => void;
    onReadTheory?: (topicKey: string, lessonKey: string) => void;
    courseComplete?: CourseStats | null;
  },
): Promise<MountResult> {
  return mount(
    <Session
      queue={over.queue}
      course={course}
      cards={over.cards ?? {}}
      dueCountAll={0}
      heading="session"
      nextStep={null}
      onScore={noop}
      onRestart={noop}
      onPickLesson={noop}
      onGoReview={noop}
      onGoTopics={noop}
      onExit={noop}
      onRetryMistakes={over.onRetryMistakes ?? noop}
      onReadTheory={over.onReadTheory ?? noop}
      courseComplete={over.courseComplete ?? null}
    />,
  );
}

// Click the correct MC option regardless of direction (pt→ru shows ru options,
// ru→pt shows pt options); the correct one carries the word's ru or pt text.
async function pickCorrect(component: MountResult) {
  const ru = component.locator(".m-opt", { hasText: word.ru });
  if ((await ru.count()) > 0) await ru.first().click();
  else await component.locator(".m-opt", { hasText: word.pt }).first().click();
}

// Answer the current exercise correctly — it may be a choice OR a manual input,
// since the exercise type is now randomized within the session.
async function answerCorrect(component: MountResult) {
  const kind = (await component.locator(".m-q-kind").textContent()) ?? "";
  if (kind.includes("Напишите")) {
    await component.locator(".m-input").fill(word.pt);
    await component.getByRole("button", { name: "Проверить" }).click();
  } else {
    await pickCorrect(component);
  }
}

test("the queue is STATIC: a miss never grows the denominator", async ({ mount }) => {
  // Две карточки одного недоученного слова — как их собрал бы interleaved-билдер.
  const component = await mountSession(mount, {
    queue: [
      { kind: "word", word, tag: "new" },
      { kind: "word", word, tag: "new" },
    ],
  });
  await expect(component.locator(".m-progress-count")).toHaveText("1/2");

  // Верный ответ не «выучивает» слово (нужны 3 выбора + 3 ввода), но переспрос
  // НЕ вставляется: знаменатель статичен, позиция просто двигается дальше.
  await answerCorrect(component);
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();
  await expect(component.locator(".m-progress-count")).toHaveText("2/2");
  await expect(component.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");

  // Вторая карточка отвечена → очередь исчерпана → финал (без доращивания).
  await answerCorrect(component);
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();
  await expect(component.getByText("Сессия завершена!")).toBeVisible();
});

test("misses are collected and offered for a retry on the Complete screen", async ({ mount }) => {
  let retried: WordView[] | null = null;
  const component = await mountSession(mount, {
    queue: [{ kind: "word", word, tag: "new" }],
    onRetryMistakes: (words) => {
      retried = words;
    },
  });

  // Новое слово всегда начинает с выбора (MC): проваливаем обе попытки —
  // кликаем две НЕВЕРНЫЕ опции (не «привет» и не «olá»).
  const wrong = component
    .locator(".m-opt")
    .filter({ hasNotText: word.ru })
    .filter({ hasNotText: word.pt });
  await wrong.nth(0).click();
  await wrong.nth(1).click();
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();

  // Финал: разбор «Споткнулся на» со строкой промаха и кнопкой повтора.
  await expect(component.getByText("Споткнулся на")).toBeVisible();
  await expect(component.locator(".m-mist-row")).toHaveCount(1);
  await expect(component.locator(".m-mist-pt")).toHaveText(word.pt);
  await component.getByRole("button", { name: "Повторить это слово" }).click();
  expect(retried).toEqual([word]);
});

// ── П.4 (рекомендации v4): Session выводит липучки из cards.lapses ────────────
test("промах слова с lapses≥порога получает бейдж и ссылку на теорию его урока", async ({
  mount,
}) => {
  let read: { topicKey: string; lessonKey: string } | null = null;
  // Слово-липучка: накоплено 5 провалов (серверный счётчик), ещё не выучено.
  const cards: Record<string, CardFields> = {
    "l1||olá": {
      interval: 0, ef: 2.5, due: 0, seen: 5, correct: 0,
      lastSeen: 0, mcCorrect: 0, typeCorrect: 0, lapses: 5,
    },
  };
  const component = await mountSession(mount, {
    queue: [{ kind: "word", word, tag: "new" }],
    cards,
    onReadTheory: (topicKey, lessonKey) => {
      read = { topicKey, lessonKey };
    },
  });

  // Новое слово → выбор (MC): проваливаем обе попытки (две неверные опции).
  const wrong = component
    .locator(".m-opt")
    .filter({ hasNotText: word.ru })
    .filter({ hasNotText: word.pt });
  await wrong.nth(0).click();
  await wrong.nth(1).click();
  await component.getByRole("button", { name: /Дальше|Завершить/ }).click();

  // Разбор: бейдж липучки + ссылка на теорию урока (course: topicKey "t", "L1").
  await expect(component.getByText("даётся тяжело")).toBeVisible();
  await component.getByRole("button", { name: /Перечитать теорию «L1»/ }).click();
  expect(read).toEqual({ topicKey: "t", lessonKey: "l1" });
});

// ── П.5 (рекомендации v4): финал курса вместо Complete, один раз ──────────────
test("courseComplete показывает финал курса вместо Complete и только один раз", async ({
  mount,
  page,
}) => {
  // CT переиспользует страницу — сбрасываем флаг «видели финал».
  await page.evaluate(() => localStorage.removeItem("pt-course-complete-seen"));
  const stats: CourseStats = { wordsTotal: 250, topicsTotal: 13, days: 10, bestStreak: 7 };
  const learnedCards: Record<string, CardFields> = {
    "l1||olá": {
      interval: 6, ef: 2.5, due: Date.now() + 6 * 86400000,
      seen: 6, correct: 6, lastSeen: Date.now(), mcCorrect: 3, typeCorrect: 3,
    },
  };
  const queue: SessionItem[] = [{ kind: "word", word, tag: "review" }];

  // Первый раз: дойдя до конца — экран финала курса (не обычный Complete).
  const first = await mountSession(mount, { queue, cards: learnedCards, courseComplete: stats });
  await answerCorrect(first);
  await first.getByRole("button", { name: /Дальше|Завершить/ }).click();
  await expect(first.getByText("Курс пройден!")).toBeVisible();
  await expect(first.locator(".m-complete")).toHaveCount(0);
  await first.unmount();

  // Второй раз: флаг уже стоит → обычный Complete, финал курса не повторяется.
  const second = await mountSession(mount, { queue, cards: learnedCards, courseComplete: stats });
  await answerCorrect(second);
  await second.getByRole("button", { name: /Дальше|Завершить/ }).click();
  await expect(second.getByText("Курс пройден!")).toHaveCount(0);
  await expect(second.getByText("Сессия завершена!")).toBeVisible();
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
      heading="session"
      nextStep={null}
      onScore={noop}
      onRestart={noop}
      onPickLesson={noop}
      onGoReview={noop}
      onGoTopics={noop}
      onExit={() => {
        exited = true;
      }}
      onRetryMistakes={noop}
      onReadTheory={noop}
      courseComplete={null}
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
      lastSeen: Date.now(),
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
        lastSeen: Date.now(),
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
