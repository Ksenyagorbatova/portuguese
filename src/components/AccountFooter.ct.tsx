import { test, expect } from "@playwright/experimental-ct-react";
import { AccountFooter } from "./AccountFooter";
import type { HooksConfig } from "../../playwright/index";

// Удаление аккаунта изнутри приложения (App Store 5.1.1(v)): строка аккаунта
// внизу главного экрана → подтверждение → мутация account:deleteAccount →
// signOut. Convex-хуки — стабы из src/test/mocks: useQuery отдаёт фикстуру
// «account:viewer», useMutation считает вызовы (window.__mutationMock.calls),
// signOut — window.__signOutCalls.
const viewer = { queries: { "account:viewer": { email: "alice@example.com" } } };

test("shows the signed-in email and a «Удалить аккаунт» button", async ({ mount }) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: viewer });
  await expect(c.getByText("alice@example.com")).toBeVisible();
  const del = c.getByRole("button", { name: "Удалить аккаунт" });
  await expect(del).toBeVisible();
  await expect(del).toHaveAttribute("type", "button");
});

test("asks for confirmation with a destructive, clearly worded dialog", async ({ mount }) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: viewer });
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  const dialog = c.getByRole("dialog");
  await expect(dialog).toContainText("Удалить аккаунт?");
  await expect(dialog).toContainText("alice@example.com");
  await expect(dialog).toContainText("удалятся навсегда");
  // Фокус — на безопасной «Отмена»; подтверждение — «опасного» вида.
  await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Удалить навсегда" })).toHaveClass(/m-btn--danger/);
});

test("«Отмена» closes the dialog and deletes nothing", async ({ mount, page }) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: viewer });
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Отмена" }).click();
  await expect(c.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(0);
  expect(await page.evaluate(() => window.__signOutCalls ?? 0)).toBe(0);
});

test("confirming deletes the account once, then signs out", async ({ mount, page }) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: viewer });
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect.poll(() => page.evaluate(() => window.__signOutCalls ?? 0)).toBe(1);
  expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(1);
  await expect(c.getByRole("dialog")).toHaveCount(0);
});

test("a failed deletion shows an error, keeps the session and allows a retry", async ({
  mount,
  page,
}) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: viewer });
  await page.evaluate(() => (window.__mutationMock = { reject: true }));
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect(c.getByRole("alert")).toContainText("Не удалось удалить аккаунт");
  expect(await page.evaluate(() => window.__signOutCalls ?? 0)).toBe(0);
  await expect(c.getByRole("button", { name: "Удалить аккаунт" })).toBeEnabled();
});

test("while the deletion is in flight the button is disabled (no double submit)", async ({
  mount,
  page,
}) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: viewer });
  await page.evaluate(() => (window.__mutationMock = { manual: true }));
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect(c.getByRole("button", { name: /Удаляем/ })).toBeDisabled();
  await page.evaluate(() => window.__mutationMock?.release?.());
  await expect.poll(() => page.evaluate(() => window.__signOutCalls ?? 0)).toBe(1);
  expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(1);
});

test("without a loaded email the footer still offers deletion", async ({ mount }) => {
  const c = await mount<HooksConfig>(<AccountFooter />, { hooksConfig: { queries: {} } });
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await expect(c.getByRole("dialog")).toContainText("Аккаунт и весь прогресс");
});
