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

test("builds and checks the sentence with the keyboard only", async ({ mount, page }) => {
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

  // Плитки — настоящие <button>: press фокусирует и активирует Enter'ом.
  const bom = component.locator(".m-bank .m-wtile").filter({ hasText: "Bom" });
  await bom.press("Enter");

  // Фокус НЕ упал на body: плитка гасится aria-disabled, а не disabled —
  // Tab-пользователь продолжает с того же места.
  const active = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    cls: document.activeElement?.className ?? "",
  }));
  expect(active.tag).toBe("BUTTON");
  expect(active.cls).toContain("m-wtile");
  await expect(bom).toHaveAttribute("aria-disabled", "true");

  // Enter по использованной (aria-disabled) плитке — no-op, дубль не добавится.
  await page.keyboard.press("Enter");
  await expect(component.locator(".m-answer .m-atile")).toHaveCount(1);

  await component.locator(".m-bank .m-wtile").filter({ hasText: "dia" }).press("Enter");
  await expect(component.locator(".m-answer .m-atile")).toHaveCount(2);
  await component.getByRole("button", { name: "Проверить" }).press("Enter");

  await expect(component.getByText("Верно!")).toBeVisible();
  expect(answeredFirstTry).toBe(true);
});

test("held Enter on «Проверить» does not skip past the feedback (autorepeat)", async ({
  mount,
  page,
}) => {
  let next = 0;
  const component = await mount(
    <SentenceBuilder
      sentence={sentence}
      isLast={false}
      onAnswered={() => {}}
      onNext={() => {
        next += 1;
      }}
    />,
  );
  await component.locator(".m-bank .m-wtile").filter({ hasText: "Bom" }).press("Enter");
  await component.locator(".m-bank .m-wtile").filter({ hasText: "dia" }).press("Enter");

  await component.getByRole("button", { name: "Проверить" }).focus();
  // resolved ставится синхронно → автофокусная «Дальше» монтируется, пока Enter
  // ещё зажат; autorepeat не должен проскочить карточку.
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter"); // e.repeat — уже на «Дальше»
  await page.keyboard.up("Enter");

  await expect(component.getByText("Верно!")).toBeVisible();
  expect(next).toBe(0); // фидбэк не проскочен

  await page.keyboard.press("Enter"); // осознанный повторный Enter — продвигает
  expect(next).toBe(1);
});

test("tiles are buttons and carry lang=pt-PT", async ({ mount }) => {
  const component = await mount(
    <SentenceBuilder sentence={sentence} isLast={false} onAnswered={() => {}} onNext={() => {}} />,
  );
  for (const tile of await component.locator(".m-bank .m-wtile").all()) {
    await expect(tile).toHaveRole("button");
    await expect(tile).toHaveAttribute("lang", "pt-PT");
  }
  await component.locator(".m-bank .m-wtile").filter({ hasText: "Bom" }).click();
  const picked = component.locator(".m-answer .m-atile");
  await expect(picked).toHaveRole("button");
  await expect(picked).toHaveAttribute("lang", "pt-PT");
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
