import { test, expect } from "@playwright/experimental-ct-react";
import { TypeExercise } from "./TypeExercise";
import { HINT_SHOW_LIMIT } from "../../lib/hints";
import { EnterTailHarness } from "../../test/EnterTailHarness";
import type { CardFields, WordView } from "../../lib/types";

const word: WordView = { lessonKey: "l1", pt: "olá", ru: "привет" };

test("accepts a correct typed answer (accents optional)", async ({ mount }) => {
  let firstTryCorrect: boolean | null = null;
  const component = await mount(
    <TypeExercise
      word={word}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={(r) => {
        firstTryCorrect = r.firstTry;
      }}
      onNext={() => {}}
    />,
  );

  await expect(component.getByText("привет")).toBeVisible(); // the prompt
  await component.getByPlaceholder("Ваш ответ…").fill("ola"); // no accent
  await component.getByRole("button", { name: "Проверить" }).click();
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
    <TypeExercise
      word={word}
      tag="due"
      card={dueCard}
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
    <TypeExercise
      word={word}
      tag="review"
      card={dueCard}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );
  await expect(component.locator(".m-q-srs")).toHaveCount(0);
});

test("offers a retry on a wrong answer", async ({ mount }) => {
  const component = await mount(
    <TypeExercise
      word={word}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );

  await component.getByPlaceholder("Ваш ответ…").fill("zzz");
  await component.getByRole("button", { name: "Проверить" }).click();
  await expect(component.getByText("Не совсем!")).toBeVisible();
});

// ── Устойчивость к сети ──────────────────────────────────────────────────────
// См. McExercise.ct.tsx: мутация управляется window.__mutationMock
// (src/test/mocks/convexReact.ts); конфиг ставится ПОСЛЕ mount и чистится
// после теста (CT переиспользует страницу); «окно roundtrip» держится
// открытым manual-режимом.
test.describe("устойчивость к сети", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.__mutationMock?.release?.(); // не оставлять зависших промисов
      delete window.__mutationMock;
    });
  });

  test("удержание Enter (авторепит) в окне roundtrip — один ответ, одна мутация", async ({
    mount,
    page,
  }) => {
    let answered = 0;
    const component = await mount(
      <TypeExercise
        word={word}
        tag="new"
        card={undefined}
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

    const input = component.getByPlaceholder("Ваш ответ…");
    await input.fill("olá");
    await input.press("Enter"); // первый keydown (repeat=false) — настоящий ответ
    // Мутация ещё висит (manual). Удержание клавиши: авторепит шлёт повторные
    // keydown с repeat=true, плюс «двойной Enter» (repeat=false) — всё в окне
    // ожидания. Диспатчим напрямую, чтобы пройти мимо disabled-семантики
    // браузера и проверить guard.
    await input.evaluate((el) => {
      for (let i = 0; i < 3; i++)
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await page.waitForTimeout(150); // дать возможным дублям докатиться до Node

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
      <TypeExercise
        word={word}
        tag="new"
        card={undefined}
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

    await component.getByPlaceholder("Ваш ответ…").fill("olá");
    await component.getByRole("button", { name: "Проверить" }).click();
    await expect(component.getByText("Верно!")).toBeVisible();
    await expect(component.getByText(/следующий повтор: —/)).toBeVisible();
    await expect(component.getByText("Не удалось сохранить ответ.")).toBeVisible();
    await component.getByRole("button", { name: /Дальше/ }).click();
    await expect.poll(() => advanced).toBe(true);
  });
});

// ── П.4 (дизайн-ревью v2): 💡-заметка не спойлерит ответ ─────────────────────
test("the 💡-note is hidden BEFORE the answer; the service hint stays", async ({ mount }) => {
  const noted: WordView = { lessonKey: "l1", pt: "olá", ru: "привет", note: "ударение на á" };
  const component = await mount(
    <TypeExercise
      word={noted}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );

  await expect(component.locator(".m-q-note")).toHaveCount(0);
  await expect(component.getByText("ударение на á")).toHaveCount(0);
  // Служебный хинт — не заметка, остаётся как был.
  await expect(component.getByText(/Акценты и пунктуация необязательны/)).toBeVisible();

  await component.getByPlaceholder("Ваш ответ…").fill("olá");
  await component.getByRole("button", { name: "Проверить" }).click();
  // После ответа заметка доступна в фидбэке.
  await expect(component.getByText(/ударение на á/)).toBeVisible();
});

// ── П.6 (дизайн-ревью v2): контраст мелкого текста ───────────────────────────
test("the ≤13px hint text uses --ink-500 (AA), not --ink-400", async ({ mount }) => {
  const component = await mount(
    <TypeExercise
      word={word}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );
  const color = await component
    .locator(".m-hint")
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(111, 110, 102)"); // #6f6e66 — --ink-500 светлой темы
});

// ── Гашение служебного хинта (опц. пункт #4 дизайн-ревью v2) ─────────────────
test("the accents hint fades out after HINT_SHOW_LIMIT mounts", async ({ mount }) => {
  const props = {
    word,
    tag: "new" as const,
    card: undefined,
    isLast: false,
    onAnswered: () => {},
    onNext: () => {},
  };
  // Первые HINT_SHOW_LIMIT показов хинт виден (каждый маунт = показ).
  for (let i = 0; i < HINT_SHOW_LIMIT; i++) {
    const c = await mount(<TypeExercise {...props} />);
    await expect(
      c.getByText(/Акценты и пунктуация необязательны/),
      `показ №${i + 1} должен быть виден`,
    ).toBeVisible();
    await c.unmount();
  }
  // Приём усвоен — хинт погас насовсем.
  const c = await mount(<TypeExercise {...props} />);
  await expect(c.locator(".m-hint")).toHaveCount(0);
});

// ── Баг-репорт владельца: Enter «проскакивает» фидбэк ────────────────────────
test.describe("Enter в инпуте НЕ проскакивает фидбэк", () => {
  test("верный ответ Enter'ом: фидбэк виден, onNext не вызван", async ({ mount }) => {
    let next = 0;
    const component = await mount(
      <TypeExercise
        word={word}
        tag="new"
        card={undefined}
        isLast={false}
        onAnswered={() => {}}
        onNext={() => {
          next += 1;
        }}
      />,
    );
    const input = component.getByPlaceholder("Ваш ответ…");
    await input.fill("olá");
    await input.press("Enter");
    await expect(component.getByText("Верно!")).toBeVisible();
    // Фидбэк должен ПЕРЕЖИТЬ нажатие: тем же Enter'ом карточку не листает.
    await component.page().waitForTimeout(400);
    await expect(component.getByText("Верно!")).toBeVisible();
    expect(next).toBe(0);
  });

  test("ПУСТОЙ Enter: ретрай-подсказка, никакого перехода", async ({ mount }) => {
    let next = 0;
    let answered = 0;
    const component = await mount(
      <TypeExercise
        word={word}
        tag="new"
        card={undefined}
        isLast={false}
        onAnswered={() => {
          answered += 1;
        }}
        onNext={() => {
          next += 1;
        }}
      />,
    );
    await component.getByPlaceholder("Ваш ответ…").press("Enter");
    await expect(component.getByText("Не совсем!")).toBeVisible();
    expect(next).toBe(0);
    expect(answered).toBe(0);
  });

  test("неверный ответ со 2-й попытки Enter'ом: фидбэк виден, onNext не вызван", async ({
    mount,
  }) => {
    let next = 0;
    const component = await mount(
      <TypeExercise
        word={word}
        tag="new"
        card={undefined}
        isLast={false}
        onAnswered={() => {}}
        onNext={() => {
          next += 1;
        }}
      />,
    );
    const input = component.getByPlaceholder("Ваш ответ…");
    await input.fill("xxx");
    await input.press("Enter"); // 1-я попытка → ретрай
    await expect(component.getByText("Не совсем!")).toBeVisible();
    await input.fill("yyy");
    await input.press("Enter"); // 2-я попытка → resolved
    await expect(component.getByText(/Правильно:/)).toBeVisible();
    await component.page().waitForTimeout(400);
    await expect(component.getByText(/Правильно:/)).toBeVisible();
    expect(next).toBe(0);
  });
});

test("кнопка «Проверить» несёт чип-подсказку Enter (aria-hidden, имя кнопки чистое)", async ({
  mount,
}) => {
  const component = await mount(
    <TypeExercise
      word={word}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );
  const chip = component.locator(".m-btn-key");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("↵");
  await expect(chip).toHaveAttribute("aria-hidden", "true");
  // Имя кнопки не «Проверить ↵» — чип скрыт от скринридера.
  await expect(component.getByRole("button", { name: "Проверить", exact: true })).toBeVisible();
});

// ── Баг-репорт владельца №2: «хвост» Enter'а с «Дальше» ──────────────────────
test("keyup-хвост Enter'а с предыдущей карточки не даёт фантомный пустой ответ", async ({
  mount,
  page,
}) => {
  await mount(<EnterTailHarness word={word} />);
  await expect(page.getByRole("button", { name: "Дальше" })).toBeFocused();

  // Нажатие (keydown) активирует «Дальше» → монтируется карточка ввода с
  // autoFocus-инпутом — клавиша ЕЩЁ зажата.
  await page.keyboard.down("Enter");
  await expect(page.getByPlaceholder("Ваш ответ…")).toBeFocused();
  // Отпускание прилетает уже в свежий инпут.
  await page.keyboard.up("Enter");
  await page.waitForTimeout(150);
  // Фантомного пустого ответа (жёлтый «Не совсем!») быть не должно.
  await expect(page.getByText("Не совсем!")).toHaveCount(0);

  // Само поведение Enter в инпуте живо: ПОЛНОЕ нажатие с пустым → ретрай.
  await page.keyboard.press("Enter");
  await expect(page.getByText("Не совсем!")).toBeVisible();
});
