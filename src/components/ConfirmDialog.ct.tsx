import { test, expect } from "@playwright/experimental-ct-react";
import { ConfirmDialog } from "./ConfirmDialog";

const labels = {
  title: "Выйти из тренировки?",
  message: "Прогресс этой сессии не сохранится.",
  confirmLabel: "Выйти",
  cancelLabel: "Остаться",
};

test("renders a modal dialog with title, message and both actions", async ({ mount }) => {
  const c = await mount(<ConfirmDialog {...labels} onConfirm={() => {}} onCancel={() => {}} />);
  const dialog = c.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toContainText("Выйти из тренировки?");
  await expect(dialog).toContainText("Прогресс этой сессии не сохранится.");
  await expect(c.getByRole("button", { name: "Выйти" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Остаться" })).toBeVisible();
});

test("opens with focus on the SAFE button («Остаться»)", async ({ mount }) => {
  const c = await mount(<ConfirmDialog {...labels} onConfirm={() => {}} onCancel={() => {}} />);
  await expect(c.getByRole("button", { name: "Остаться" })).toBeFocused();
});

test("Escape cancels (= «Остаться»)", async ({ mount, page }) => {
  let cancelled = 0;
  const c = await mount(
    <ConfirmDialog {...labels} onConfirm={() => {}} onCancel={() => (cancelled += 1)} />,
  );
  await expect(c.getByRole("button", { name: "Остаться" })).toBeFocused();
  await page.keyboard.press("Escape");
  expect(cancelled).toBe(1);
});

test("Tab is trapped inside the dialog (cycles between the two buttons)", async ({
  mount,
  page,
}) => {
  const c = await mount(<ConfirmDialog {...labels} onConfirm={() => {}} onCancel={() => {}} />);
  const stay = c.getByRole("button", { name: "Остаться" });
  const exit = c.getByRole("button", { name: "Выйти" });

  await expect(stay).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(exit).toBeFocused();
  await page.keyboard.press("Tab"); // цикл: фокус НЕ уходит за пределы диалога
  await expect(stay).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(exit).toBeFocused();
});

test("the buttons fire their callbacks", async ({ mount }) => {
  let confirmed = 0;
  let cancelled = 0;
  const c = await mount(
    <ConfirmDialog
      {...labels}
      onConfirm={() => (confirmed += 1)}
      onCancel={() => (cancelled += 1)}
    />,
  );
  await c.getByRole("button", { name: "Остаться" }).click();
  expect(cancelled).toBe(1);
  await c.getByRole("button", { name: "Выйти" }).click();
  expect(confirmed).toBe(1);
});

test("clicking the overlay backdrop cancels, clicking the card does not", async ({
  mount,
  page,
}) => {
  let cancelled = 0;
  await mount(<ConfirmDialog {...labels} onConfirm={() => {}} onCancel={() => (cancelled += 1)} />);
  // Клик по карточке — не закрывает (stopPropagation).
  await page.locator(".m-dialog").click({ position: { x: 10, y: 10 } });
  expect(cancelled).toBe(0);
  // Клик по подложке (угол оверлея, мимо карточки) — «остаться».
  await page.locator(".m-dialog-overlay").click({ position: { x: 5, y: 5 } });
  expect(cancelled).toBe(1);
});
