import { test, expect } from "@playwright/experimental-ct-react";
import { McExercise } from "./McExercise";
import type { CardFields, Course, WordView } from "../../lib/types";

const word: WordView = { lessonKey: "l1", pt: "olá", ru: "привет" };
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

test("pt→ru: a correct first pick resolves to success", async ({ mount }) => {
  let firstTryCorrect: boolean | null = null;
  const component = await mount(
    <McExercise
      word={word}
      mode="pt_ru"
      tag="new"
      card={undefined}
      course={course}
      isLast={false}
      onAnswered={(r) => {
        firstTryCorrect = r.firstTry;
      }}
      onNext={() => {}}
    />,
  );

  await expect(component.getByText("olá")).toBeVisible(); // the prompt word
  await component.getByRole("button", { name: "привет" }).click(); // correct translation
  await expect(component.getByText("Верно!")).toBeVisible();
  expect(firstTryCorrect).toBe(true);
});

const dueCard: CardFields = {
  interval: 10,
  ef: 2.5,
  due: Date.now() - 86400000, // overdue
  seen: 4,
  correct: 4,
  lastSeen: Date.now() - 86400000,
  mcCorrect: 3,
  typeCorrect: 3,
};

test("a DUE word shows the «следующий повтор» line without «интервал»", async ({ mount }) => {
  const component = await mount(
    <McExercise
      word={word}
      mode="pt_ru"
      tag="due"
      card={dueCard}
      course={course}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );
  const srs = component.locator(".m-q-srs");
  await expect(srs).toBeVisible();
  await expect(srs).toContainText("следующий повтор:");
  await expect(srs).not.toContainText("интервал");
});

test("a non-due word (early practice) hides the pre-answer SRS line", async ({ mount }) => {
  const component = await mount(
    <McExercise
      word={word}
      mode="pt_ru"
      tag="review"
      card={dueCard}
      course={course}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );
  await expect(component.locator(".m-q-srs")).toHaveCount(0);
});

test("reveals the answer after two wrong picks", async ({ mount }) => {
  const component = await mount(
    <McExercise
      word={word}
      mode="pt_ru"
      tag="new"
      card={undefined}
      course={course}
      isLast={true}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );

  await component.getByRole("button", { name: "пока" }).click(); // wrong #1 → retry
  await expect(component.getByText("Не совсем!")).toBeVisible();
  await component.getByRole("button", { name: "да" }).click(); // wrong #2 → resolved
  await expect(component.getByText("Правильно:")).toBeVisible();
});

// ── Устойчивость к сети ──────────────────────────────────────────────────────
// Мутация recordAnswer идёт по сети: пока ответ сервера не пришёл, повторные
// клики не должны давать второй ответ, а отказ мутации не должен подвешивать
// упражнение. Поведение мутации управляется window.__mutationMock (см. стаб
// src/test/mocks/convexReact.ts). Конфиг ставим ПОСЛЕ mount (он читается в
// момент вызова мутации; первый mount в воркере навигирует страницу и стёр бы
// его) и чистим после теста — CT переиспользует страницу между тестами.
// «Окно roundtrip» держим открытым manual-режимом (release по команде):
// задержки-таймеры на холодном воркере флаки.
test.describe("устойчивость к сети", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.__mutationMock?.release?.(); // не оставлять зависших промисов
      delete window.__mutationMock;
    });
  });

  test("двойной клик в окне сетевого roundtrip — onAnswered и recordAnswer по одному разу", async ({
    mount,
    page,
  }) => {
    let answered = 0;
    const component = await mount(
      <McExercise
        word={word}
        mode="pt_ru"
        tag="new"
        card={undefined}
        course={course}
        isLast={false}
        onAnswered={() => {
          answered += 1;
        }}
        onNext={() => {}}
      />,
    );
    await page.evaluate(() => {
      window.__mutationMock = { manual: true };
    });

    const correct = component.getByRole("button", { name: "привет" });
    await correct.click();
    // Мутация ещё висит (manual) — окно гонки гарантированно открыто. Второй
    // клик диспатчим напрямую, чтобы пройти мимо disabled-семантики браузера
    // и проверить именно синхронный guard от повторного finish().
    await correct.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(150); // дать возможному дублю докатиться до Node

    expect(answered).toBe(1);
    expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(1);

    // Отпускаем «сеть» — упражнение доводится до конца как обычно.
    await page.evaluate(() => window.__mutationMock?.release?.());
    await expect(component.getByText("Верно!")).toBeVisible();
    expect(answered).toBe(1);
    expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(1);
  });

  test("reject мутации не подвешивает упражнение: фидбэк, «—» и «Дальше» на месте", async ({
    mount,
    page,
  }) => {
    let advanced = false;
    const component = await mount(
      <McExercise
        word={word}
        mode="pt_ru"
        tag="new"
        card={undefined}
        course={course}
        isLast={false}
        onAnswered={() => {}}
        onNext={() => {
          advanced = true;
        }}
      />,
    );
    await page.evaluate(() => {
      window.__mutationMock = { reject: true };
    });

    await component.getByRole("button", { name: "привет" }).click();
    await expect(component.getByText("Верно!")).toBeVisible();
    await expect(component.getByText(/следующий повтор: —/)).toBeVisible();
    await expect(component.getByText("Не удалось сохранить ответ.")).toBeVisible();
    await component.getByRole("button", { name: /Дальше/ }).click();
    await expect.poll(() => advanced).toBe(true);
  });

  test("пока сервер молчит — фидбэк с «—», метка повтора подтягивается после ответа", async ({
    mount,
    page,
  }) => {
    const component = await mount(
      <McExercise
        word={word}
        mode="pt_ru"
        tag="new"
        card={undefined}
        course={course}
        isLast={false}
        onAnswered={() => {}}
        onNext={() => {}}
      />,
    );
    await page.evaluate(() => {
      window.__mutationMock = { manual: true };
    });

    await component.getByRole("button", { name: "привет" }).click();
    // Ответа сервера ещё нет — но фидбэк уже виден, метка — заглушка.
    await expect(component.getByText("Верно!")).toBeVisible();
    await expect(component.getByText(/следующий повтор: —/)).toBeVisible();
    // Сервер ответил (mock: due через сутки) → метка обновилась.
    await page.evaluate(() => window.__mutationMock?.release?.());
    await expect(component.getByText(/следующий повтор: завтра/)).toBeVisible();
  });
});
