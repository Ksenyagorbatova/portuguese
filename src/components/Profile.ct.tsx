import { test, expect } from "@playwright/experimental-ct-react";
import { Profile } from "./Profile";
import type { ThemeChoice } from "../lib/useTheme";

const noop = () => {};
const props = { email: "dev@example.com", themeChoice: "light" as ThemeChoice, onCycleTheme: noop, muted: false, onToggleMute: noop };

for (const [theme, label] of [["light", "Светлая"], ["dark", "Тёмная"], ["system", "Как на устройстве"]] as const) {
  test(`profile describes and changes the ${theme} theme`, async ({ mount }) => {
    let cycles = 0;
    const c = await mount(<Profile {...props} themeChoice={theme} onCycleTheme={() => { cycles++; }} />);
    await expect(c.getByText(label, { exact: true })).toBeVisible();
    await c.getByRole("button", { name: /^Тема:/ }).click();
    expect(cycles).toBe(1);
  });
}

test("profile controls sound and keeps account actions accessible", async ({ mount, page }) => {
  let toggles = 0;
  const c = await mount(<Profile {...props} onToggleMute={() => { toggles++; }} />);
  await c.getByRole("button", { name: /Автоозвучка/ }).click();
  expect(toggles).toBe(1);
  await expect(c.getByRole("button", { name: /Автоозвучка/ })).toHaveAttribute("aria-pressed", "true");
  await c.update(<Profile {...props} muted />);
  await expect(c.getByRole("button", { name: /Автоозвучка/ })).toHaveAttribute("aria-pressed", "false");
  await expect(c.getByText("dev@example.com")).toBeVisible();
  await expect(c.getByRole("button", { name: "Удалить аккаунт" })).toBeVisible();
  await c.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect.poll(() => page.evaluate(() => window.__signOutCalls ?? 0)).toBe(1);
});
