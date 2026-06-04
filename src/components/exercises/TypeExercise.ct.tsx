import { test, expect } from "@playwright/experimental-ct-react";
import { TypeExercise } from "./TypeExercise";
import type { WordView } from "../../lib/types";

const word: WordView = { lessonKey: "l1", pt: "olá", ru: "привет" };

test("accepts a correct typed answer (accents optional)", async ({ mount }) => {
  let firstTryCorrect: boolean | null = null;
  const component = await mount(
    <TypeExercise
      word={word}
      tag="new"
      card={undefined}
      isLast={false}
      onAnswered={(ok) => {
        firstTryCorrect = ok;
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
