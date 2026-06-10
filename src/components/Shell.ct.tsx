import { test, expect } from "@playwright/experimental-ct-react";
import { Shell } from "./Shell";
import type { HooksConfig } from "../../playwright/index";

// Shell pulls course/SRS via Convex useQuery — the "convex/react" stub serves
// the fixtures below, passed per test through mount's hooksConfig (see
// playwright/index.tsx). 4+ words so the MC exercise has its distractors.
const lesson = {
  lessonKey: "l1",
  label: "Урок 1",
  theory: { intro: "Вводный текст", tip: "Подсказка", sections: [] },
  words: [
    { lessonKey: "l1", pt: "olá", ru: "привет" },
    { lessonKey: "l1", pt: "adeus", ru: "пока" },
    { lessonKey: "l1", pt: "sim", ru: "да" },
    { lessonKey: "l1", pt: "não", ru: "нет" },
  ],
};
const course = {
  topics: [{ topicKey: "t1", label: "Приветствия", icon: "👋", lessons: [lesson] }],
  crossSentences: [],
};

// RAW getSrsState payload (cards/tags as ARRAYS — Shell adapts via adaptSrs).
function queries(over: { seenTheory?: string[] } = {}): Record<string, unknown> {
  return {
    "courseQueries:getCourse": course,
    "progress:getSrsState": {
      streak: 0,
      cards: [],
      tags: [],
      seenTheory: over.seenTheory ?? [],
      learnedPts: [],
      dueCountAll: 0,
      lessonStats: {},
      topicStats: {},
    },
  };
}

const noop = () => {};

test("a lesson with unseen theory opens through the theory screen", async ({ mount }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries() },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();

  // Theory screen, not a session: title + «Начать практику».
  await expect(c.locator(".m-theory-title")).toHaveText("Урок 1");
  await expect(c.getByRole("button", { name: /Начать практику/ })).toBeVisible();
  await expect(c.locator(".m-progress-count")).toHaveCount(0);
});

test("a lesson with seen theory starts the session right away", async ({ mount }) => {
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries({ seenTheory: ["l1"] }) },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();

  // Straight into the session: the whole lesson is queued (4 words).
  await expect(c.locator(".m-progress-count")).toHaveText("1/4");
  await expect(c.locator(".m-q-kind")).toBeVisible();
});

test("logo click during a session asks for confirmation before exiting", async ({
  mount,
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries({ seenTheory: ["l1"] }) },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();
  await expect(c.locator(".m-q-kind")).toBeVisible();

  await c.getByRole("button", { name: "На главный экран" }).click();
  expect(dialogs).toEqual(["Выйти из тренировки?"]);
  // Confirmed → back to the review home (hero), session gone.
  await expect(c.locator(".m-hero")).toBeVisible();
  await expect(c.locator(".m-q-kind")).toHaveCount(0);
});

test("cancelling the confirm keeps the session running", async ({ mount, page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries({ seenTheory: ["l1"] }) },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByText("Урок 1").click();
  await expect(c.locator(".m-q-kind")).toBeVisible();

  await c.getByRole("button", { name: "На главный экран" }).click();
  expect(dialogs).toEqual(["Выйти из тренировки?"]);
  // Dismissed → the exercise is still on screen.
  await expect(c.locator(".m-q-kind")).toBeVisible();
  await expect(c.locator(".m-progress-count")).toHaveText("1/4");
});

test("logo click outside a session goes home without any confirm", async ({ mount, page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const c = await mount<HooksConfig>(<Shell themeChoice="light" onCycleTheme={noop} />, {
    hooksConfig: { queries: queries() },
  });
  await c.getByRole("button", { name: "Темы", exact: true }).click();
  await c.getByRole("button", { name: "На главный экран" }).click();

  await expect(c.locator(".m-hero")).toBeVisible();
  expect(dialogs).toEqual([]);
});
