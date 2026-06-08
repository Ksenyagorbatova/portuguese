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

test("a non-new card shows the «следующий повтор» line without «интервал»", async ({ mount }) => {
  const card: CardFields = {
    interval: 4,
    ef: 2.5,
    due: Date.now() + 4 * 86400000,
    seen: 1,
    correct: 3,
    lastSeen: Date.now(),
    mcCorrect: 2,
    typeCorrect: 1,
  };
  const component = await mount(
    <TypeExercise
      word={word}
      tag="review"
      card={card}
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
