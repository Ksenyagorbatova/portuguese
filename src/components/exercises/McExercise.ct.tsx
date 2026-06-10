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
  await page.keyboard.press("abcde"[i]);
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
