import { test, expect } from "@playwright/experimental-ct-react";
import { Header } from "./Header";

// Header pulls useAuthActions from @convex-dev/auth/react, aliased to a stub in
// playwright-ct.config.ts, so it mounts without a live auth provider.

const noop = () => {};

test("shows only the logo on the left — no title or kicker text", async ({ mount }) => {
  const c = await mount(<Header streak={5} theme="light" onToggleTheme={noop} onHome={noop} />);
  await expect(c.locator(".m-logo")).toHaveText("pt");
  await expect(c.getByText("Тренажёр")).toHaveCount(0);
  await expect(c.getByText(/Português/)).toHaveCount(0);
});

test("puts «выйти» last in the right cluster — after the theme/streak icons", async ({ mount }) => {
  const c = await mount(<Header streak={7} theme="light" onToggleTheme={noop} onHome={noop} />);
  // «выйти» lives inside the right cluster (.m-header-right), not under the logo,
  // and is the LAST control (to the right of the theme toggle and streak).
  await expect(c.locator(".m-brand .m-signout")).toHaveCount(0);
  await expect(c.locator(".m-header-right > *:last-child")).toHaveClass(/m-signout/);
  await expect(c.locator(".m-header-right .m-signout")).toHaveText("выйти");
  await expect(c.locator(".m-streak")).toContainText("7");
});

test("the logo is a button that navigates home", async ({ mount }) => {
  let wentHome = false;
  const c = await mount(
    <Header streak={3} theme="light" onToggleTheme={noop} onHome={() => (wentHome = true)} />,
  );
  const logo = c.getByRole("button", { name: "На главный экран" });
  await expect(logo).toHaveText("pt");
  await logo.click();
  expect(wentHome).toBe(true);
});

test("renders the theme toggle with an accessible label", async ({ mount }) => {
  const c = await mount(<Header streak={1} theme="light" onToggleTheme={noop} onHome={noop} />);
  await expect(c.getByRole("button", { name: "Тёмная тема" })).toBeVisible();
});
