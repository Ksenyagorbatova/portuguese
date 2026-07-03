import { test, expect } from "@playwright/experimental-ct-react";
import { ClozeExercise } from "./ClozeExercise";
import type { AnswerResult, TopicSentenceView } from "../../lib/types";

const sentence: TopicSentenceView = {
  sentenceKey: "ts_1",
  topicKey: "t",
  words: ["Quem", "é?"],
  answer: "Quem é?",
  ru: "Кто это?",
  blank: "Quem",
};
// Пул blank-слов темы → дистракторы (все ≠ цели по норме).
const pool = ["Quem", "isto", "meu", "Onde"];
const noop = () => {};

test("cloze renders the gap, the ru prompt and the option buttons", async ({ mount }) => {
  const component = await mount(
    <ClozeExercise sentence={sentence} pool={pool} isLast={false} onAnswered={noop} onNext={noop} />,
  );
  await expect(component.locator(".m-cloze-gap")).toBeVisible(); // прочерк на месте пропуска
  await expect(component).toContainText("Кто это?"); // ru-подсказка
  await expect(component.locator(".m-opt")).toHaveCount(4); // 1 верный + 3 дистрактора
  // Целевое слово в предложении спрятано (в тексте вопроса его нет до ответа).
  await expect(component.locator(".m-q-text")).not.toContainText("Quem");
});

test("a correct pick resolves to success and reports the sentence answer", async ({ mount }) => {
  let result: AnswerResult | null = null;
  const component = await mount(
    <ClozeExercise
      sentence={sentence}
      pool={pool}
      isLast={false}
      onAnswered={(r) => {
        result = r;
      }}
      onNext={noop}
    />,
  );
  await component.getByRole("button", { name: /Quem/ }).click();
  expect(result).toMatchObject({ mode: "sentence", correct: true, firstTry: true });
  await expect(component).toContainText("Верно!");
  await expect(component.locator(".m-fb-pt")).toContainText("Quem é?"); // полный ответ в фидбэке
});

test("a wrong pick gives one retry, then a correct pick still succeeds", async ({ mount }) => {
  let result: AnswerResult | null = null;
  const component = await mount(
    <ClozeExercise
      sentence={sentence}
      pool={pool}
      isLast={false}
      onAnswered={(r) => {
        result = r;
      }}
      onNext={noop}
    />,
  );
  await component.getByRole("button", { name: /isto/ }).click(); // неверный
  await expect(component).toContainText("Ещё одна попытка");
  expect(result).toBeNull(); // ответ ещё не зафиксирован
  await component.getByRole("button", { name: /Quem/ }).click(); // верный со 2-й попытки
  expect(result).toMatchObject({ mode: "sentence", correct: true, firstTry: false });
});

test("two wrong picks resolve to failure and reveal the answer", async ({ mount }) => {
  let result: AnswerResult | null = null;
  const component = await mount(
    <ClozeExercise
      sentence={sentence}
      pool={pool}
      isLast={false}
      onAnswered={(r) => {
        result = r;
      }}
      onNext={noop}
    />,
  );
  await component.getByRole("button", { name: /isto/ }).click();
  await component.getByRole("button", { name: /meu/ }).click();
  expect(result).toMatchObject({ mode: "sentence", correct: false, firstTry: false });
  await expect(component).toContainText("Правильно:");
  await expect(component.locator(".m-fb-pt")).toContainText("Quem é?");
});
