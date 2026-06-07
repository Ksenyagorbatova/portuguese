import { test, expect } from "@playwright/experimental-ct-react";
import { Theory } from "./Theory";
import type { LessonView } from "../lib/types";

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
