import { test, expect } from "@playwright/experimental-ct-react";
import { Complete } from "./Complete";
import { REVIEW_DUE_LIMIT } from "../lib/queue";
import type { WordView } from "../lib/types";

const noop = () => {};
const base = {
  correct: 4,
  total: 4,
  dueCountAll: 0,
  heading: "session" as const,
  nextStep: null,
  mistakes: [] as WordView[],
  onRestart: noop,
  onPickLesson: noop,
  onGoReview: noop,
  onRetryMistakes: noop,
};

test("celebrates a perfect score and restarts (no step forward → primary «Ещё раз»)", async ({
  mount,
}) => {
  let restarted = false;
  const component = await mount(
    <Complete {...base} onRestart={() => (restarted = true)} />,
  );

  await expect(component).toContainText("Сессия завершена!");
  await expect(component).toContainText("100%");
  await expect(component).toContainText("Все повторения сделаны");
  await component.getByRole("button", { name: "Ещё раз" }).click();
  expect(restarted).toBe(true);
});

test("pending reviews: «Ещё N слов ждут» is GONE, «К повторению» carries the count", async ({
  mount,
}) => {
  let wentReview = false;
  const component = await mount(
    <Complete {...base} correct={1} dueCountAll={5} onGoReview={() => (wentReview = true)} />,
  );

  // Укора больше нет — ни текста про «ждут повторения», ни ok-ноты при долге.
  await expect(component).not.toContainText("ждут повторения");
  await expect(component).not.toContainText("Все повторения сделаны");
  await component.getByRole("button", { name: "К повторению (5)" }).click();
  expect(wentReview).toBe(true);
});

test("the review counter is capped at REVIEW_DUE_LIMIT (как у кнопки героя)", async ({
  mount,
}) => {
  const component = await mount(<Complete {...base} dueCountAll={REVIEW_DUE_LIMIT + 22} />);
  await expect(
    component.getByRole("button", { name: `К повторению (${REVIEW_DUE_LIMIT})` }),
  ).toBeVisible();
});

test("mistakes recap: rows with pt — ru and a retry button for ALL misses", async ({ mount }) => {
  let retried = false;
  const mistakes: WordView[] = [
    { lessonKey: "l1", pt: "olá", ru: "привет" },
    { lessonKey: "l1", pt: "adeus", ru: "пока" },
  ];
  const component = await mount(
    <Complete {...base} mistakes={mistakes} onRetryMistakes={() => (retried = true)} />,
  );

  await expect(component.getByText("Споткнулся на")).toBeVisible();
  await expect(component.locator(".m-mist-row")).toHaveCount(2);
  await expect(component.locator(".m-mist-row").first()).toContainText("olá");
  await expect(component.locator(".m-mist-row").first()).toContainText("привет");
  // Озвучка в каждой строке.
  await expect(component.getByRole("button", { name: "Прослушать olá" })).toBeVisible();

  await component.getByRole("button", { name: "Повторить эти 2 слова" }).click();
  expect(retried).toBe(true);
});

test("no mistakes → no recap block", async ({ mount }) => {
  const component = await mount(<Complete {...base} />);
  await expect(component.getByText("Споткнулся на")).toHaveCount(0);
  await expect(component.locator(".m-mist-row")).toHaveCount(0);
});

test("mid-lesson: primary CTA continues the lesson, no duplicate «Ещё раз»", async ({ mount }) => {
  let restarted = false;
  const component = await mount(
    <Complete
      {...base}
      nextStep={{ kind: "continue", remaining: 6 }}
      onRestart={() => (restarted = true)}
    />,
  );

  await component.getByRole("button", { name: "Продолжить урок (ещё 6 слов)" }).click();
  expect(restarted).toBe(true);
  // «Ещё раз» дублировал бы primary (то же действие) — его нет.
  await expect(component.getByRole("button", { name: "Ещё раз" })).toHaveCount(0);
});

test("lesson done: primary CTA opens the next lesson, «Ещё раз» becomes ghost", async ({
  mount,
}) => {
  let picked: string | null = null;
  const component = await mount(
    <Complete
      {...base}
      heading="lesson"
      nextStep={{ kind: "lesson", topicKey: "t1", lessonKey: "l2", label: "Урок 2" }}
      onPickLesson={(_topicKey, lessonKey) => (picked = lessonKey)}
    />,
  );

  await expect(component).toContainText("Урок выучен!");
  await component.getByRole("button", { name: "Следующий урок: Урок 2" }).click();
  expect(picked).toBe("l2");
  await expect(component.getByRole("button", { name: "Ещё раз" })).toBeVisible();
});

test("topic rollover: primary CTA leads to the first lesson of the next topic", async ({
  mount,
}) => {
  let picked: { topicKey: string; lessonKey: string } | null = null;
  const component = await mount(
    <Complete
      {...base}
      heading="topic"
      nextStep={{ kind: "topic", topicKey: "t2", lessonKey: "l21", label: "Числа" }}
      onPickLesson={(topicKey, lessonKey) => (picked = { topicKey, lessonKey })}
    />,
  );

  await expect(component).toContainText("Тема закрыта!");
  await component.getByRole("button", { name: "Следующая тема: Числа" }).click();
  expect(picked).toEqual({ topicKey: "t2", lessonKey: "l21" });
});

test("pluralizes the retry button: 1 слово / 2 слова / 5 слов", async ({ mount }) => {
  const wordsOf = (n: number): WordView[] =>
    Array.from({ length: n }, (_, i) => ({ lessonKey: "l1", pt: `w${i}`, ru: `п${i}` }));

  const one = await mount(<Complete {...base} mistakes={wordsOf(1)} />);
  await expect(one.getByRole("button", { name: "Повторить это слово" })).toBeVisible();
  await one.unmount();

  const five = await mount(<Complete {...base} mistakes={wordsOf(5)} />);
  await expect(five.getByRole("button", { name: "Повторить эти 5 слов" })).toBeVisible();
});
