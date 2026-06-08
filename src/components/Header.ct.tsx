import { test, expect } from "@playwright/experimental-ct-react";
import { Header } from "./Header";

// Header pulls useAuthActions from @convex-dev/auth/react, aliased to a stub in
// playwright-ct.config.ts, so it mounts without a live auth provider.

const noop = () => {};

test("shows only the logo on the left — no title or kicker text", async ({ mount }) => {
  const c = await mount(<Header streak={5} themeChoice="light" onCycleTheme={noop} onHome={noop} />);
  await expect(c.locator(".m-logo")).toHaveText("pt");
  await expect(c.getByText("Тренажёр")).toHaveCount(0);
  await expect(c.getByText(/Português/)).toHaveCount(0);
});

test("right cluster order is streak → theme → exit, exit being an icon button", async ({ mount }) => {
  const c = await mount(<Header streak={7} themeChoice="light" onCycleTheme={noop} onHome={noop} />);
  // The old text «выйти» button is gone — exit is now an icon door.
  await expect(c.locator(".m-signout")).toHaveCount(0);
  await expect(c.getByText("выйти")).toHaveCount(0);
  // Streak leads the cluster; the exit icon button trails it.
  await expect(c.locator(".m-header-right > *:first-child")).toHaveClass(/m-streak/);
  const exit = c.locator(".m-header-right > *:last-child");
  await expect(exit).toHaveClass(/m-icon-btn/);
  await expect(exit).toHaveAttribute("aria-label", "Выйти");
  await expect(c.locator(".m-streak")).toContainText("7");
});

test("exit button carries an accessible label and the log-out icon", async ({ mount }) => {
  const c = await mount(<Header streak={2} themeChoice="light" onCycleTheme={noop} onHome={noop} />);
  await expect(c.getByRole("button", { name: "Выйти" })).toBeVisible();
});

test("the logo is a button that navigates home", async ({ mount }) => {
  let wentHome = false;
  const c = await mount(
    <Header streak={3} themeChoice="light" onCycleTheme={() => {}} onHome={() => (wentHome = true)} />,
  );
  const logo = c.getByRole("button", { name: "На главный экран" });
  await expect(logo).toHaveText("pt");
  await logo.click();
  expect(wentHome).toBe(true);
});

test("theme toggle shows the light label/icon for the light choice", async ({ mount }) => {
  const c = await mount(<Header streak={1} themeChoice="light" onCycleTheme={noop} onHome={noop} />);
  await expect(c.getByRole("button", { name: "Тема: светлая" })).toBeVisible();
});

test("theme toggle shows the dark label/icon for the dark choice", async ({ mount }) => {
  const c = await mount(<Header streak={1} themeChoice="dark" onCycleTheme={noop} onHome={noop} />);
  await expect(c.getByRole("button", { name: "Тема: тёмная" })).toBeVisible();
});

test("theme toggle shows the system label/icon for the system choice", async ({ mount }) => {
  const c = await mount(<Header streak={1} themeChoice="system" onCycleTheme={noop} onHome={noop} />);
  await expect(c.getByRole("button", { name: "Тема: системная" })).toBeVisible();
});

test("clicking the theme toggle cycles the choice", async ({ mount }) => {
  let clicks = 0;
  const c = await mount(
    <Header streak={1} themeChoice="system" onCycleTheme={() => (clicks += 1)} onHome={noop} />,
  );
  await c.getByRole("button", { name: "Тема: системная" }).click();
  expect(clicks).toBe(1);
});
