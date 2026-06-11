import { test, expect } from "@playwright/experimental-ct-react";
import { CourseComplete } from "./CourseComplete";

// П.5: финал курса — чистый презентационный компонент, цифры приходят пропами.

test("показывает итог пути и ведёт на повторение", async ({ mount }) => {
  let review = 0;
  const c = await mount(
    <CourseComplete
      wordsTotal={250}
      topicsTotal={13}
      days={47}
      bestStreak={21}
      onGoReview={() => (review += 1)}
    />,
  );
  await expect(c.getByText("Курс пройден!")).toBeVisible();
  await expect(c.getByText("Все 13 тем закрыты. Boa viagem!")).toBeVisible();
  // три плитки: слова / дни / лучший стрик
  await expect(c.locator(".m-course-stat")).toHaveCount(3);
  await expect(c).toContainText("250");
  await expect(c).toContainText("47");
  await expect(c).toContainText("🔥 21");
  // CTA честный: SRS не заканчивается.
  await c.getByRole("button", { name: "Повторение продолжается" }).click();
  expect(review).toBe(1);
});

test("без startedAt (days=null) плитка «дней» исчезает — экран не ломается", async ({ mount }) => {
  const c = await mount(
    <CourseComplete wordsTotal={250} topicsTotal={13} days={null} bestStreak={5} onGoReview={() => {}} />,
  );
  await expect(c.getByText("Курс пройден!")).toBeVisible();
  await expect(c.locator(".m-course-stat")).toHaveCount(2); // только слова + стрик
  await expect(c).toContainText("🔥 5");
});

test("плюрализация подзаголовка и подписей плиток", async ({ mount }) => {
  const c = await mount(
    <CourseComplete wordsTotal={1} topicsTotal={2} days={1} bestStreak={1} onGoReview={() => {}} />,
  );
  await expect(c.getByText("Все 2 темы закрыты. Boa viagem!")).toBeVisible();
  await expect(c.locator(".m-course-stat-l", { hasText: "слово" })).toBeVisible();
  await expect(c.locator(".m-course-stat-l", { hasText: "день" })).toBeVisible();
});
