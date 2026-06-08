import { test, expect } from "@playwright/experimental-ct-react";
import { TypeExercise } from "./TypeExercise";
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
