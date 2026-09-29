import { test, expect } from "@playwright/experimental-ct-react";
import { Header } from "./Header";

const noop = () => {};
const defaults = { streak: 5, doneToday: false, muted: false, onToggleMute: noop, onHome: noop };

test("the study header keeps the logo, streak and sound; settings live in profile", async ({ mount }) => {
  const c = await mount(<Header {...defaults} />);
  await expect(c.getByRole("button", { name: "На главный экран" })).toHaveText("pt");
  await expect(c.locator(".m-streak")).toContainText("5");
  await expect(c.getByRole("button", { name: "Звук: включён" })).toBeVisible();
  await expect(c.getByRole("button")).toHaveCount(2);
  await expect(c.getByRole("button", { name: /Тема|Выйти/ })).toHaveCount(0);
});

test("logo and mute callbacks still work", async ({ mount }) => {
  let homes = 0;
  let mutes = 0;
  const c = await mount(<Header {...defaults} onHome={() => { homes++; }} onToggleMute={() => { mutes++; }} />);
  await c.getByRole("button", { name: "На главный экран" }).click();
  await c.getByRole("button", { name: "Звук: включён" }).click();
  expect(homes).toBe(1);
  expect(mutes).toBe(1);
});

test("muted state has an accessible label", async ({ mount }) => {
  const c = await mount(<Header {...defaults} muted />);
  await expect(c.getByRole("button", { name: "Звук: выключен" })).toBeVisible();
});

test("sound retains its keyboard focus ring and a 44px target", async ({ mount, page }) => {
  const c = await mount(<Header {...defaults} />);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const sound = c.getByRole("button", { name: "Звук: включён" });
  await expect(sound).toBeFocused();
  const shadow = await sound.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain("0px 0px 0px 4px");
  const box = await sound.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("the daily streak communicates whether today is complete", async ({ mount }) => {
  const c = await mount(<Header {...defaults} streak={4} />);
  await expect(c.locator(".m-streak")).toHaveAttribute("aria-label", "Стрик 4 дня, сегодня ещё не пройдено");
  await expect(c.locator(".m-streak-day")).not.toHaveClass(/done/);
  await c.update(<Header {...defaults} doneToday />);
  await expect(c.locator(".m-streak")).toHaveAttribute("aria-label", "Стрик 5 дней, сегодня пройдено");
  await expect(c.locator(".m-streak-day")).toHaveClass(/done/);
});
