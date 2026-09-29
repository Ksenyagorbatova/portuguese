import { test, expect } from "@playwright/experimental-ct-react";
import { Theory } from "./Theory";
import type { LessonView } from "../lib/types";
import { HINT_SHOW_LIMIT } from "../lib/hints";

const lesson: LessonView = {
  lessonKey: "l1",
  label: "Приветствия",
  theory: {
    intro: "Вводный текст урока.",
    tip: "Полезный совет.",
    sections: [{ heading: "Слова", words: ["olá"] }],
  },
  words: [{ lessonKey: "l1", pt: "olá", ru: "привет" }],
};

test("long theory is split into short pages with all words reachable before practice", async ({ mount, page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const words = Array.from({ length: 10 }, (_, i) => ({ lessonKey: "l1", pt: `palavra${i}`, ru: `слово ${i}` }));
  let began = false;
  const c = await mount(<Theory lesson={{ ...lesson, words, theory: { ...lesson.theory,
    sections: [{ heading: "Слова", words: words.map((w) => w.pt) }] } }} onBegin={() => { began = true; }} />);
  await expect(c.locator(".m-flip")).toHaveCount(4);
  await expect(c.locator(".m-theory-step")).toHaveText("1 / 3 · Слова");
  await c.getByRole("button", { name: "Следующие слова" }).click();
  await expect(c.getByText("palavra4", { exact: true })).toBeVisible();
  await c.getByRole("button", { name: "Следующие слова" }).click();
  await expect(c.locator(".m-flip")).toHaveCount(2);
  await c.getByRole("button", { name: "Предыдущие слова" }).click();
  await expect(c.locator(".m-theory-step")).toHaveText("2 / 3 · Слова");
  await c.getByRole("button", { name: "Следующие слова" }).click();
  const begin = c.getByRole("button", { name: /Начать практику/ });
  const box = await begin.boundingBox();
  expect(box!.y).toBeGreaterThan(550);
  expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  await begin.click();
  expect(began).toBe(true);
});

test("renders the lesson theory and word cards", async ({ mount }) => {
  const component = await mount(<Theory lesson={lesson} onBegin={() => {}} />);
  await expect(component).toContainText("Приветствия");
  await expect(component).toContainText("Вводный текст урока.");
  await expect(component).toContainText("Слова");
  await expect(component.getByText("olá")).toBeVisible();
});

test("starts practice via the CTA", async ({ mount }) => {
  let began = false;
  const component = await mount(
    <Theory
      lesson={lesson}
      onBegin={() => {
        began = true;
      }}
    />,
  );
  await component.getByRole("button", { name: /Начать практику/ }).click();
  expect(began).toBe(true);
});

test("the flip card is a keyboard-operable button with pt-PT side", async ({ mount }) => {
  const component = await mount(<Theory lesson={lesson} onBegin={() => {}} />);
  const flip = component.locator(".m-flip");
  await expect(flip).toHaveRole("button");
  await expect(flip.locator(".m-flip-pt")).toHaveAttribute("lang", "pt-PT");
  await expect(flip).toHaveAttribute("aria-pressed", "false");

  await flip.press("Enter"); // фокус + Enter = переворот с клавиатуры
  await expect(flip).toHaveClass(/flipped/);
  await expect(flip).toHaveAttribute("aria-pressed", "true");

  await flip.press("Space"); // Space переворачивает обратно
  await expect(flip).not.toHaveClass(/flipped/);
});

test("shows no back button when onBack is omitted", async ({ mount }) => {
  const component = await mount(<Theory lesson={lesson} onBegin={() => {}} />);
  await expect(component.getByRole("button", { name: /Назад/ })).toHaveCount(0);
});

test("returns via the back button when onBack is provided", async ({ mount }) => {
  let went = false;
  const component = await mount(
    <Theory
      lesson={lesson}
      onBegin={() => {}}
      onBack={() => {
        went = true;
      }}
    />,
  );
  await component.getByRole("button", { name: /Назад/ }).click();
  expect(went).toBe(true);
});

// ── Гашение хинта «Нажми на карточку…» (опц. пункт #4 дизайн-ревью v2) ───────
test("the flip hint fades out after HINT_SHOW_LIMIT theory opens", async ({ mount }) => {
  for (let i = 0; i < HINT_SHOW_LIMIT; i++) {
    const c = await mount(<Theory lesson={lesson} onBegin={() => {}} />);
    await expect(c.getByText(/Нажми на карточку/)).toBeVisible();
    await c.unmount();
  }
  const c = await mount(<Theory lesson={lesson} onBegin={() => {}} />);
  await expect(c.getByText(/Нажми на карточку/)).toHaveCount(0);
});
