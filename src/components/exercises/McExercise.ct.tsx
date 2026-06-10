import { test, expect, type MountResult } from "@playwright/experimental-ct-react";
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

// ── Хоткеи и клавиатура ──────────────────────────────────────────────────────

// Опции перемешаны — находим индекс правильной («привет») и жмём её клавишу.
async function correctIndex(component: MountResult) {
  const labels = await component.locator(".m-opt .m-opt-label").allTextContents();
  const i = labels.findIndex((l) => l.trim() === "привет");
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}

test("digit hotkey (1–5) picks the matching option", async ({ mount, page }) => {
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
  const i = await correctIndex(component);
  await page.keyboard.press(String(i + 1));
  await expect(component.getByText("Верно!")).toBeVisible();
  expect(firstTryCorrect).toBe(true);
});

test("Latin letter hotkey (A–E) picks the matching option", async ({ mount, page }) => {
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
  const i = await correctIndex(component);
  // С модификатором (Shift тоже модификатор) хоткей молчит…
  await page.keyboard.press(`Shift+${"abcde"[i]}`);
  await expect(component.getByText("Верно!")).toHaveCount(0);
  expect(answered).toBe(0);
  // …а голая буква выбирает опцию.
  await page.keyboard.press("abcde"[i]);
  await expect(component.getByText("Верно!")).toBeVisible();
  expect(answered).toBe(1);
});

test("RU layout: physical A–E keys (e.code) pick options via the code fallback", async ({
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
  const i = await correctIndex(component);
  // В русской раскладке физические KeyA–KeyE печатают кириллицу — e.key не
  // матчится, должен сработать фоллбэк по e.code (синтезируем настоящую пару
  // key/code этой раскладки: KeyA→«ф», KeyB→«и», KeyC→«с», KeyD→«в», KeyE→«у»).
  await page.evaluate(
    ([key, code]) => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
    },
    [["ф", "и", "с", "в", "у"][i], "Key" + "ABCDE"[i]] as const,
  );
  await expect(component.getByText("Верно!")).toBeVisible();
  expect(answered).toBe(1);
});

test("hotkeys are inert for an already-missed (disabled) option and after resolve", async ({
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
  const labels = await component.locator(".m-opt .m-opt-label").allTextContents();
  const wrong = labels.findIndex((l) => l.trim() !== "привет");
  const right = labels.findIndex((l) => l.trim() === "привет");

  await page.keyboard.press(String(wrong + 1)); // промах → ретрай
  await expect(component.getByText("Не совсем!")).toBeVisible();
  await page.keyboard.press(String(wrong + 1)); // та же опция disabled — игнор
  await expect(component.getByText("Не совсем!")).toBeVisible();
  expect(answered).toBe(0); // второй промах НЕ засчитан — ответа ещё нет

  await page.keyboard.press(String(right + 1)); // со второй попытки — верно
  await expect(component.getByText("Верно!")).toBeVisible();
  expect(answered).toBe(1);

  await page.keyboard.press(String(wrong + 1)); // после ответа хоткеи молчат
  expect(answered).toBe(1);
});

test("Enter after the answer presses the autofocused «Дальше»", async ({ mount, page }) => {
  let next = 0;
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
        next += 1;
      }}
    />,
  );
  const i = await correctIndex(component);
  await page.keyboard.press(String(i + 1));
  const nextBtn = component.getByRole("button", { name: /Дальше/ });
  await expect(nextBtn).toBeFocused();
  await page.keyboard.press("Enter");
  expect(next).toBe(1);
});

test("marks Portuguese text with lang=pt-PT (question in pt→ru, options in ru→pt)", async ({
  mount,
}) => {
  const ptRu = await mount(
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
  await expect(ptRu.locator(".m-q-text")).toHaveAttribute("lang", "pt-PT");
  await expect(ptRu.locator(".m-opt-label").first()).not.toHaveAttribute("lang");
  await ptRu.unmount();

  const ruPt = await mount(
    <McExercise
      word={word}
      mode="ru_pt"
      tag="new"
      card={undefined}
      course={course}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );
  await expect(ruPt.locator(".m-q-text")).not.toHaveAttribute("lang");
  for (const label of await ruPt.locator(".m-opt-label").all())
    await expect(label).toHaveAttribute("lang", "pt-PT");
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

// ── П.4 (дизайн-ревью v2): 💡-заметка не спойлерит ответ ─────────────────────
test("the 💡-note is hidden BEFORE the answer and shown in the feedback after", async ({
  mount,
}) => {
  // Заметка часто пересказывает перевод — до ответа её быть не должно.
  const noted: WordView = { lessonKey: "l1", pt: "olá", ru: "привет", note: "ударение на á" };
  const component = await mount(
    <McExercise
      word={noted}
      mode="pt_ru"
      tag="new"
      card={undefined}
      course={course}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {}}
    />,
  );

  await expect(component.locator(".m-q-note")).toHaveCount(0);
  await expect(component.getByText("ударение на á")).toHaveCount(0);

  await component.getByRole("button", { name: "привет" }).click();
  // После ответа заметка по-прежнему доступна — в фидбэке (WordFeedback).
  await expect(component.getByText(/ударение на á/)).toBeVisible();
});

// ── П.5 (дизайн-ревью v2): кольцо ТОЛЬКО на клавиатурном фокусе ──────────────
test("keyboard focus draws the accent ring; mouse click does not", async ({ mount, page }) => {
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

  // Мышиный клик кольца не рисует (:focus-visible, не :focus). Мышь — первое
  // взаимодействие: после Tab браузер удерживал бы focus-visible на элементе.
  const audio = component.locator(".m-audio");
  await audio.click();
  await expect(audio).toBeFocused();
  const clicked = await audio.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(clicked).not.toContain("0px 0px 0px 4px");

  // Клавиатурный фокус (Tab с 🔊 на первую опцию) кольцо рисует.
  await page.keyboard.press("Tab");
  const opt = component.locator(".m-opt").first();
  await expect(opt).toBeFocused();
  const focused = await opt.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(focused).toContain("0px 0px 0px 4px"); // кольцо --accent-ring
});

test("the option keeps its own shadow under the focus ring", async ({ mount, page }) => {
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
  // Tab: 🔊 → первая опция (.m-opt с собственной тенью --e1).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const opt = component.locator(".m-opt").first();
  await expect(opt).toBeFocused();
  const shadow = await opt.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain("0px 0px 0px 4px"); // кольцо…
  // …добавлено к собственной тени, не вместо неё: ДВА слоя = два цвета
  // (запятую искать нельзя — она есть и внутри rgba()).
  expect(shadow.match(/rgba?\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
});

// ── П.10 (дизайн-ревью v2): discoverability медленного повтора ───────────────
test("the 🔊 button advertises the slow-replay double tap", async ({ mount }) => {
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
  await expect(
    component.getByRole("button", { name: "Прослушать (второй тап — медленно)" }),
  ).toBeVisible();
});
