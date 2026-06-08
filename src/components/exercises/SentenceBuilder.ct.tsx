import { test, expect } from "@playwright/experimental-ct-react";
import { SentenceBuilder } from "./SentenceBuilder";
import type { CrossSentenceView } from "../../lib/types";

const sentence: CrossSentenceView = {
  sentenceKey: "cs_0001",
  words: ["Bom", "dia"],
  answer: "Bom dia",
  ru: "Доброе утро",
  required: [],
};

test("shows the Russian prompt and the word tiles", async ({ mount }) => {
  const component = await mount(
    <SentenceBuilder sentence={sentence} isLast={false} onAnswered={() => {}} onNext={() => {}} />,
  );
  await expect(component.getByText("Доброе утро")).toBeVisible();
  await expect(component.locator(".m-bank .m-wtile")).toHaveCount(2);
});

test("accepts the correctly built sentence", async ({ mount }) => {
  let answeredFirstTry: boolean | null = null;
  const component = await mount(
    <SentenceBuilder
      sentence={sentence}
      isLast={false}
      onAnswered={(r) => {
        answeredFirstTry = r.firstTry;
      }}
      onNext={() => {}}
    />,
  );

  // Pick tiles from the bank in the right order (text is unique per tile here).
  await component.locator(".m-bank .m-wtile").filter({ hasText: "Bom" }).click();
  await component.locator(".m-bank .m-wtile").filter({ hasText: "dia" }).click();
  await component.getByRole("button", { name: "Проверить" }).click();

  await expect(component.getByText("Верно!")).toBeVisible();
  expect(answeredFirstTry).toBe(true);
  // Once resolved, the ✕ remove-hints are gone (tiles are no longer editable).
  await expect(component.locator(".m-atile-x")).toHaveCount(0);
});

test("answer tiles show a removable ✕ and clicking a tile removes it", async ({ mount }) => {
  const component = await mount(
    <SentenceBuilder sentence={sentence} isLast={false} onAnswered={() => {}} onNext={() => {}} />,
  );

  await component.locator(".m-bank .m-wtile").filter({ hasText: "Bom" }).click();
  await component.locator(".m-bank .m-wtile").filter({ hasText: "dia" }).click();

  await expect(component.locator(".m-answer .m-atile")).toHaveCount(2);
  await expect(component.locator(".m-answer .m-atile .m-atile-x")).toHaveCount(2);

  await component.locator(".m-answer .m-atile").first().click();
  await expect(component.locator(".m-answer .m-atile")).toHaveCount(1);
});
