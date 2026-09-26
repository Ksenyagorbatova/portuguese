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

// Опасное действие (удаление аккаунта): подтверждение красного тона, а не
// основного зелёного; по умолчанию — прежний primary.
test("the danger variant styles the confirm button as destructive", async ({ mount }) => {
  const c = await mount(
    <ConfirmDialog {...labels} danger onConfirm={() => {}} onCancel={() => {}} />,
  );
  await expect(c.getByRole("button", { name: "Выйти" })).toHaveClass(/m-btn--danger/);
  await expect(c.getByRole("button", { name: "Выйти" })).not.toHaveClass(/m-btn--primary/);
});

test("without danger the confirm button stays primary", async ({ mount }) => {
  const c = await mount(<ConfirmDialog {...labels} onConfirm={() => {}} onCancel={() => {}} />);
  await expect(c.getByRole("button", { name: "Выйти" })).toHaveClass(/m-btn--primary/);
});

// Пока действие в пути (удаление аккаунта): кнопки aria-disabled (фокус
// остаётся в диалоге), подтверждение показывает pendingLabel, Esc и подложка
// не отменяют, повторных вызовов нет.
test("pending: buttons are aria-disabled, confirm shows progress, Esc and backdrop do not cancel", async ({
  mount,
  page,
}) => {
  let confirmed = 0;
  let cancelled = 0;
  const c = await mount(
    <ConfirmDialog
      {...labels}
      danger
      pending
      pendingLabel="Удаляем…"
      onConfirm={() => (confirmed += 1)}
      onCancel={() => (cancelled += 1)}
    />,
  );
  const confirm = c.getByRole("button", { name: "Удаляем…" });
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  await expect(c.getByRole("button", { name: "Остаться" })).toHaveAttribute("aria-disabled", "true");
  // force: Playwright считает aria-disabled неактивным и сам не кликнул бы —
  // а пользователь кликнуть может; проверяем, что обработчики молчат.
  await confirm.click({ force: true });
  await c.getByRole("button", { name: "Остаться" }).click({ force: true });
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5); // подложка
  expect(confirmed).toBe(0);
  expect(cancelled).toBe(0);
  await expect(c.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
});
