import { test, expect } from "@playwright/experimental-ct-react";
import { Shell } from "./Shell";
import type { HooksConfig } from "../../playwright/index";

// Shell pulls course/SRS via Convex useQuery — the "convex/react" stub serves
// the fixtures below, passed per test through mount's hooksConfig (see
// playwright/index.tsx). 4+ words so the MC exercise has its distractors.
const lesson = {
  lessonKey: "l1",
  label: "Урок 1",
  theory: { intro: "Вводный текст", tip: "Подсказка", sections: [] },
  words: [
    { lessonKey: "l1", pt: "olá", ru: "привет" },
    { lessonKey: "l1", pt: "adeus", ru: "пока" },
    { lessonKey: "l1", pt: "sim", ru: "да" },
    { lessonKey: "l1", pt: "não", ru: "нет" },
  ],
};
const course = {
  topics: [{ topicKey: "t1", label: "Приветствия", icon: "👋", lessons: [lesson] }],
  crossSentences: [],
};

// RAW getSrsState payload (cards/tags as ARRAYS — Shell adapts via adaptSrs).
function queries(
  over: {
    seenTheory?: string[];
    cards?: unknown[];
    tags?: unknown[];
    learnedPts?: string[];
  } = {},
): Record<string, unknown> {
  return {
    "courseQueries:getCourse": course,
    "progress:getSrsState": {
      streak: 0,
      lastDay: null,
      cards: over.cards ?? [],
      tags: over.tags ?? [],
      seenTheory: over.seenTheory ?? [],
      learnedPts: over.learnedPts ?? [],
      dueCountAll: 0,
      lessonStats: {},
      topicStats: {},
    },
  };
}

// Review-сессия из ОДНОГО уже выученного слова (оба навыка на пороге): один
// верный ответ исчерпывает очередь — кратчайший путь к экрану Complete.
function oneLearnedWordQueries(): Record<string, unknown> {
  return queries({
    seenTheory: ["l1"],
    cards: [
      {
        lessonKey: "l1",
        pt: "olá",
        interval: 6,
        ef: 2.5,
        due: Date.now() + 6 * 86400000,
        seen: 6,
        correct: 6,
        lastSeen: Date.now(),
        mcCorrect: 3,
        typeCorrect: 3,
      },
    ],
    tags: [{ lessonKey: "l1", pt: "olá", tag: "learned" }],
    learnedPts: ["olá"],
  });
}

const noop = () => {};

test("a lesson with unseen theory opens through the theory screen", async ({ mount }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries() },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();

  // Theory screen, not a session: title + «Начать практику».
  await expect(c.locator(".m-theory-title")).toHaveText("Урок 1");
  await expect(c.getByRole("button", { name: /Начать практику/ })).toBeVisible();
  await expect(c.locator(".m-progress-count")).toHaveCount(0);
});

test("a lesson with seen theory starts the session right away", async ({ mount }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries({ seenTheory: ["l1"] }) },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();

  // Straight into the session: a static queue capped at SESSION_SIZE
  // (4 unfinished words × 6 owed reps = 24 candidates → 20).
  await expect(c.locator(".m-progress-count")).toHaveText("1/20");
  await expect(c.locator(".m-q-kind")).toBeVisible();
});

test("logo click during a session opens the in-app exit dialog; «Выйти» leaves", async ({
  mount,
}) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries({ seenTheory: ["l1"] }) },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();
  await expect(c.locator(".m-q-kind")).toBeVisible();

  await c.getByRole("button", { name: "На главный экран" }).click();
  // Свой диалог (не window.confirm): role=dialog в стиле системы.
  const dialog = c.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Выйти из тренировки?");

  // «Выйти» именно в диалоге (в хедере есть одноимённая кнопка выхода из аккаунта).
  await dialog.getByRole("button", { name: "Выйти" }).click();
  // Confirmed → back to the review home (hero), session and dialog gone.
  await expect(c.locator(".m-hero")).toBeVisible();
  await expect(c.locator(".m-q-kind")).toHaveCount(0);
  await expect(c.getByRole("dialog")).toHaveCount(0);
});

test("«Остаться» (and Esc) keep the session running", async ({ mount, page }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries({ seenTheory: ["l1"] }) },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();
  await expect(c.locator(".m-q-kind")).toBeVisible();

  // «Остаться» закрывает диалог, сессия на месте.
  await c.getByRole("button", { name: "На главный экран" }).click();
  await c.getByRole("button", { name: "Остаться" }).click();
  await expect(c.getByRole("dialog")).toHaveCount(0);
  await expect(c.locator(".m-q-kind")).toBeVisible();

  // Esc — то же самое.
  await c.getByRole("button", { name: "На главный экран" }).click();
  await expect(c.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(c.getByRole("dialog")).toHaveCount(0);
  await expect(c.locator(".m-q-kind")).toBeVisible();
  await expect(c.locator(".m-progress-count")).toHaveText("1/20");
});

test("logo click on the Complete screen leaves without any confirm", async ({ mount }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: oneLearnedWordQueries() },
  });
  // due=0 → CTA «Тренировать все слова» запускает review-сессию из 1 слова.
  await c.getByRole("button", { name: "Тренировать все слова" }).click();
  await expect(c.locator(".m-progress-count")).toHaveText("1/1");

  // Отвечаем верно (тип упражнения для выученного слова случайный — MC или ввод).
  const kind = (await c.locator(".m-q-kind").textContent()) ?? "";
  if (kind.includes("Напишите")) {
    await c.locator(".m-input").fill("olá");
    await c.getByRole("button", { name: "Проверить" }).click();
  } else {
    const ru = c.locator(".m-opt", { hasText: "привет" });
    if ((await ru.count()) > 0) await ru.first().click();
    else await c.locator(".m-opt", { hasText: "olá" }).first().click();
  }
  await c.getByRole("button", { name: /Дальше|Завершить/ }).click();
  await expect(c.getByText("Сессия завершена!")).toBeVisible();

  // Логотип с экрана Complete: прерывать нечего — домой БЕЗ диалога.
  await c.getByRole("button", { name: "На главный экран" }).click();
  await expect(c.getByRole("dialog")).toHaveCount(0);
  await expect(c.locator(".m-hero")).toBeVisible();
});

test("a 100%-finished topic rolls the Complete CTA over to the next topic", async ({ mount }) => {
  // Тема t1 выучена целиком (один learned-урок), у t2 теория ещё не открыта:
  // финал должен озаглавиться «Тема закрыта!» и перекатить CTA на первый урок
  // следующей темы (через openLesson → экран теории, раз она не просмотрена).
  const rolloverCourse = {
    topics: [
      {
        topicKey: "t1",
        label: "Приветствия",
        icon: "👋",
        lessons: [
          {
            lessonKey: "l1",
            label: "Урок 1",
            theory: { intro: "", tip: "", sections: [] },
            words: [{ lessonKey: "l1", pt: "olá", ru: "привет" }],
          },
        ],
      },
      {
        topicKey: "t2",
        label: "Числа",
        icon: "🔢",
        lessons: [
          {
            lessonKey: "l2",
            label: "Числа 1–5",
            theory: { intro: "Цифры", tip: "", sections: [] },
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
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: {
      queries: {
        "courseQueries:getCourse": rolloverCourse,
        "progress:getSrsState": {
          streak: 0,
          lastDay: null,
          cards: [
            {
              lessonKey: "l1",
              pt: "olá",
              interval: 6,
              ef: 2.5,
              due: Date.now() + 6 * 86400000,
              seen: 6,
              correct: 6,
              lastSeen: Date.now(),
              mcCorrect: 3,
              typeCorrect: 3,
            },
          ],
          tags: [{ lessonKey: "l1", pt: "olá", tag: "learned" }],
          seenTheory: ["l1"],
          learnedPts: ["olá"],
          dueCountAll: 0,
          lessonStats: {
            l1: { total: 1, seen: 1, learned: 1, due: 0 },
            l2: { total: 3, seen: 0, learned: 0, due: 0 },
          },
          topicStats: {
            t1: { total: 1, seen: 1, learned: 1, due: 0 },
            t2: { total: 3, seen: 0, learned: 0, due: 0 },
          },
        },
      },
    },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();
  // Урок выучен целиком → одно-проходное повторение из единственного слова.
  await expect(c.locator(".m-progress-count")).toHaveText("1/1");
  const kind = (await c.locator(".m-q-kind").textContent()) ?? "";
  if (kind.includes("Напишите")) {
    await c.locator(".m-input").fill("olá");
    await c.getByRole("button", { name: "Проверить" }).click();
  } else {
    const ru = c.locator(".m-opt", { hasText: "привет" });
    if ((await ru.count()) > 0) await ru.first().click();
    else await c.locator(".m-opt", { hasText: "olá" }).first().click();
  }
  await c.getByRole("button", { name: /Дальше|Завершить/ }).click();

  await expect(c.getByText("Тема закрыта!")).toBeVisible();
  await c.getByRole("button", { name: "Следующая тема: Числа" }).click();
  await expect(c.locator(".m-theory-title")).toHaveText("Числа 1–5");
});

test("logo click outside a session goes home without any confirm", async ({ mount }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries() },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByRole("button", { name: "На главный экран" }).click();

  await expect(c.locator(".m-hero")).toBeVisible();
  await expect(c.getByRole("dialog")).toHaveCount(0);
});
