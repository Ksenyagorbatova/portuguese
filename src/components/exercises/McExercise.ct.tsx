import { test, expect } from "@playwright/experimental-ct-react";
import { McExercise } from "./McExercise";
import type { Course, WordView } from "../../lib/types";

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
      onAnswered={(ok) => {
        firstTryCorrect = ok;
      }}
      onNext={() => {}}
    />,
  );

  await expect(component.getByText("olá")).toBeVisible(); // the prompt word
  await component.getByRole("button", { name: "привет" }).click(); // correct translation
  await expect(component.getByText("Верно!")).toBeVisible();
  expect(firstTryCorrect).toBe(true);
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
