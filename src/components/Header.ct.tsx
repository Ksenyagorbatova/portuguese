import { test, expect } from "@playwright/experimental-ct-react";
import type { ComponentFixtures, MountResult } from "@playwright/experimental-ct-react";
import { Header } from "./Header";
import type { ThemeChoice } from "../lib/useTheme";

// Header pulls useAuthActions from @convex-dev/auth/react, aliased to a stub in
// playwright-ct.config.ts, so it mounts without a live auth provider.

const noop = () => {};

const defaults = {
  streak: 5,
  doneToday: false,
  muted: false,
  onToggleMute: noop,
  themeChoice: "light" as ThemeChoice,
  onCycleTheme: noop,
  onHome: noop,
};

function mountHeader(
  mount: ComponentFixtures["mount"],
  over: Partial<typeof defaults> = {},
): Promise<MountResult> {
  return mount(<Header {...defaults} {...over} />);
}

test("shows only the logo on the left — no title or kicker text", async ({ mount }) => {
  const c = await mountHeader(mount);
  await expect(c.locator(".m-logo")).toHaveText("pt");
  await expect(c.getByText("Тренажёр")).toHaveCount(0);
  await expect(c.getByText(/Português/)).toHaveCount(0);
});

test("right cluster: streak leads and the exit icon button trails", async ({ mount }) => {
  const c = await mountHeader(mount, { streak: 7 });
  // The old text «выйти» button is gone — exit is now an icon door.
  await expect(c.locator(".m-signout")).toHaveCount(0);
  await expect(c.getByText("выйти")).toHaveCount(0);
  // Streak leads the cluster; the exit icon button trails it (mute + theme sit
  // between them — see the dedicated ordering test below).
  await expect(c.locator(".m-header-right > *:first-child")).toHaveClass(/m-streak/);
  const exit = c.locator(".m-header-right > *:last-child");
  await expect(exit).toHaveClass(/m-icon-btn/);
  await expect(exit).toHaveAttribute("aria-label", "Выйти");
  await expect(c.locator(".m-streak")).toContainText("7");
});

test("exit button carries an accessible label and the log-out icon", async ({ mount }) => {
  const c = await mountHeader(mount, { streak: 2 });
  await expect(c.getByRole("button", { name: "Выйти" })).toBeVisible();
});

test("the logo is a button that navigates home", async ({ mount }) => {
  let wentHome = false;
  const c = await mountHeader(mount, { streak: 3, onHome: () => (wentHome = true) });
  const logo = c.getByRole("button", { name: "На главный экран" });
  await expect(logo).toHaveText("pt");
  await logo.click();
  expect(wentHome).toBe(true);
});

test("theme toggle shows the light label/icon for the light choice", async ({ mount }) => {
  const c = await mountHeader(mount, { streak: 1, themeChoice: "light" });
  await expect(c.getByRole("button", { name: "Тема: светлая" })).toBeVisible();
});

test("theme toggle shows the dark label/icon for the dark choice", async ({ mount }) => {
  const c = await mountHeader(mount, { streak: 1, themeChoice: "dark" });
  await expect(c.getByRole("button", { name: "Тема: тёмная" })).toBeVisible();
});

test("theme toggle shows the system label/icon for the system choice", async ({ mount }) => {
  const c = await mountHeader(mount, { streak: 1, themeChoice: "system" });
  await expect(c.getByRole("button", { name: "Тема: системная" })).toBeVisible();
});

test("clicking the theme toggle cycles the choice", async ({ mount }) => {
  let clicks = 0;
  const c = await mountHeader(mount, { streak: 1, themeChoice: "system", onCycleTheme: () => (clicks += 1) });
  await c.getByRole("button", { name: "Тема: системная" }).click();
  expect(clicks).toBe(1);
});

// ── П.3 (рекомендации v4): кнопка mute ───────────────────────────────────────
test("mute toggle shows the volume icon and «Звук: включён» label when sound is on", async ({
  mount,
}) => {
  const c = await mountHeader(mount, { muted: false });
  await expect(c.getByRole("button", { name: "Звук: включён" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Звук: выключен" })).toHaveCount(0);
});

test("mute toggle shows the «Звук: выключен» label when muted", async ({ mount }) => {
  const c = await mountHeader(mount, { muted: true });
  await expect(c.getByRole("button", { name: "Звук: выключен" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Звук: включён" })).toHaveCount(0);
});

test("clicking the mute toggle fires onToggleMute", async ({ mount }) => {
  let toggles = 0;
  const c = await mountHeader(mount, { onToggleMute: () => (toggles += 1) });
  await c.getByRole("button", { name: "Звук: включён" }).click();
  expect(toggles).toBe(1);
});

test("the mute button sits between the streak and the theme toggle", async ({ mount }) => {
  const c = await mountHeader(mount);
  // header-right children: [streak div, mute btn, theme btn, exit btn].
  const second = c.locator(".m-header-right > *:nth-child(2)");
  await expect(second).toHaveClass(/m-icon-btn/);
  await expect(second).toHaveAttribute("aria-label", /Звук/);
});

// ── П.5 (дизайн-ревью v2): кольцо фокуса не съедает собственную тень ─────────
test("icon buttons keep their own shadow under the keyboard-focus ring", async ({
  mount,
  page,
}) => {
  const c = await mountHeader(mount, { streak: 1 });
  // Tab: логотип → mute → переключатель темы (.m-icon-btn с собственной тенью --e1).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const themeBtn = c.getByRole("button", { name: "Тема: светлая" });
  await expect(themeBtn).toBeFocused();
  const shadow = await themeBtn.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain("0px 0px 0px 4px"); // кольцо…
  // …добавлено к тени --e1, не вместо неё: в computed box-shadow ДВА слоя
  // (= два цвета). Запятую искать нельзя — она есть и внутри rgba().
  expect(shadow.match(/rgba?\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
});

// ── П.7 (дизайн-ревью v2): статус «день закрыт» в пилюле стрика ──────────────
test("before the first session of the day the streak shows a grey day circle", async ({
  mount,
}) => {
  const c = await mountHeader(mount, { streak: 4, doneToday: false });
  const day = c.locator(".m-streak-day");
  await expect(day).toBeVisible();
  await expect(day).not.toHaveClass(/done/);
  await expect(c.locator(".m-streak")).toHaveAttribute(
    "aria-label",
    "Стрик 4 дня, сегодня ещё не пройдено",
  );
});

test("after the first session of the day the circle turns into an accent check", async ({
  mount,
}) => {
  const c = await mountHeader(mount, { streak: 5, doneToday: true });
  await expect(c.locator(".m-streak-day")).toHaveClass(/done/);
  await expect(c.locator(".m-streak")).toHaveAttribute(
    "aria-label",
    "Стрик 5 дней, сегодня пройдено",
  );
});
