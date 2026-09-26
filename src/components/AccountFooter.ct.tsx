import { test, expect } from "@playwright/experimental-ct-react";
import { AccountFooter } from "./AccountFooter";
import type { HooksConfig } from "../../playwright/index";

// Удаление аккаунта изнутри приложения (App Store 5.1.1(v)): строка аккаунта
// внизу главного экрана → подтверждение → мутация account:deleteAccount →
// signOut. Convex-хуки — стабы из src/test/mocks: useMutation считает вызовы
// (window.__mutationMock.calls), signOut — window.__signOutCalls, состояние
// сокета — hooksConfig.connection.

test("shows the signed-in email and a «Удалить аккаунт» button", async ({ mount }) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await expect(c.getByText("alice@example.com")).toBeVisible();
  const del = c.getByRole("button", { name: "Удалить аккаунт" });
  await expect(del).toBeEnabled();
  await expect(del).toHaveAttribute("type", "button");
});

test("asks for confirmation with a destructive, clearly worded dialog", async ({ mount }) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
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
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Отмена" }).click();
  await expect(c.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(0);
  expect(await page.evaluate(() => window.__signOutCalls ?? 0)).toBe(0);
});

test("confirming deletes the account once, then signs out", async ({ mount, page }) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect.poll(() => page.evaluate(() => window.__signOutCalls ?? 0)).toBe(1);
  expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(1);
});

// Пока запрос в пути, диалог остаётся модальным: не уйти с экрана (футер бы
// размонтировался и потерял результат), Esc/подложка не закрывают, повторного
// запроса нет.
test("while the deletion is in flight the dialog stays up, shows progress and blocks cancel", async ({
  mount,
  page,
}) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await page.evaluate(() => (window.__mutationMock = { manual: true }));
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();

  const dialog = c.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Удаляем аккаунт…" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(dialog.getByRole("button", { name: "Отмена" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Удаляем аккаунт…" }).click({ force: true });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => window.__mutationMock?.calls ?? 0)).toBe(1);

  await page.evaluate(() => window.__mutationMock?.release?.());
  await expect.poll(() => page.evaluate(() => window.__signOutCalls ?? 0)).toBe(1);
});

test("a failed deletion shows an error, keeps the session and returns focus to the button", async ({
  mount,
  page,
}) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await page.evaluate(() => (window.__mutationMock = { reject: true }));
  const del = c.getByRole("button", { name: "Удалить аккаунт" });
  await del.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab"); // «Отмена» → «Удалить навсегда»
  await expect(c.getByRole("button", { name: "Удалить навсегда" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(c.getByRole("alert")).toContainText("Не удалось удалить аккаунт");
  await expect(c.getByRole("dialog")).toHaveCount(0);
  await expect(del).toBeEnabled();
  await expect(del).toBeFocused();
  expect(await page.evaluate(() => window.__signOutCalls ?? 0)).toBe(0);
});

// Офлайн мутация встала бы в очередь без ответа (и потерялась бы при закрытии
// приложения) — кнопку отключаем с объяснением.
test("offline, deletion is disabled with an explanation", async ({ mount }) => {
  const c = await mount<HooksConfig>(<AccountFooter email="alice@example.com" />, {
    hooksConfig: { connection: { isWebSocketConnected: false } },
  });
  await expect(c.getByRole("button", { name: "Удалить аккаунт" })).toBeDisabled();
  await expect(c.getByText("Удалить аккаунт можно при подключении к сети")).toBeVisible();
});

test("without a loaded email the footer still offers deletion", async ({ mount }) => {
  const c = await mount(<AccountFooter email={null} />);
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await expect(c.getByRole("dialog")).toContainText("Аккаунт и весь прогресс");
});

// Флаг «финал курса уже видели» (localStorage) выводится из прогресса: после
// удаления аккаунта новый аккаунт на этом устройстве снова должен увидеть финал.
test("a successful deletion forgets the course-finale flag", async ({ mount, page }) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await page.evaluate(() => localStorage.setItem("pt-course-complete-seen", "1"));
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect.poll(() => page.evaluate(() => window.__signOutCalls ?? 0)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("pt-course-complete-seen"))).toBeNull();
});

test("a failed deletion keeps the course-finale flag", async ({ mount, page }) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  await page.evaluate(() => {
    localStorage.setItem("pt-course-complete-seen", "1");
    window.__mutationMock = { reject: true };
  });
  await c.getByRole("button", { name: "Удалить аккаунт" }).click();
  await c.getByRole("button", { name: "Удалить навсегда" }).click();
  await expect(c.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("pt-course-complete-seen"))).toBe("1");
  await page.evaluate(() => localStorage.removeItem("pt-course-complete-seen"));
});

// Длинный email без точек переноса не должен вылезать за карточку диалога и
// обрезаться краем экрана: это адрес, который вот-вот удалят навсегда.
test("a long email wraps inside the confirmation dialog on a narrow phone", async ({ mount, page }) => {
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 640 });
  try {
    const email = "aleksandra.konstantinopolskaya.long@example.com";
    const c = await mount(<AccountFooter email={email} />);
    await c.getByRole("button", { name: "Удалить аккаунт" }).click();
    const msg = c.locator(".m-dialog-msg");
    await expect(msg).toContainText(email);
    const fit = await msg.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return {
        overflow: el.scrollWidth - el.clientWidth,
        textRight: range.getBoundingClientRect().right,
        cardRight: el.closest(".m-dialog")!.getBoundingClientRect().right,
      };
    });
    expect(fit.overflow).toBeLessThanOrEqual(0);
    expect(fit.textRight).toBeLessThanOrEqual(fit.cardRight);
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
});

// Единственный вход в удаление — текстовая кнопка 13px: зона нажатия
// дотягивается до 44pt (Apple HIG) невидимым ::after, как у других мелких
// контролов (.m-session-exit, .m-lesson-theory).
test("the delete button has a 44px-tall touch target", async ({ mount, page }) => {
  const c = await mount(<AccountFooter email="alice@example.com" />);
  const box = (await c.getByRole("button", { name: "Удалить аккаунт" }).boundingBox())!;
  const x = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const hits = await page.evaluate(
    ({ x, ys }) => ys.map((y) => document.elementFromPoint(x, y)?.textContent ?? null),
    { x, ys: [cy - 21, cy + 21] },
  );
  expect(hits).toEqual(["Удалить аккаунт", "Удалить аккаунт"]);
});

// WCAG 1.4.3 (AA, 4.5:1 для обычного текста): email — единственная подсказка,
// КАКОЙ аккаунт удаляется; пояснение офлайн — тоже мелкий текст.
function luminance(rgb: string): number {
  const [r, g, b] = rgb
    .match(/\d+(?:\.\d+)?/g)!
    .slice(0, 3)
    .map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("the email and the offline note read at WCAG AA contrast in both themes", async ({
  mount,
  page,
}) => {
  await mount<HooksConfig>(<AccountFooter email="alice@example.com" />, {
    hooksConfig: { connection: { isWebSocketConnected: false } },
  });
  try {
    for (const theme of ["light", "dark"]) {
      const colors = await page.evaluate(async (t) => {
        document.documentElement.dataset.theme = t;
        // Фон body плавно перетекает при смене темы — читаем после перехода.
        await Promise.all(document.getAnimations().map((a) => a.finished));
        const color = (sel: string) => getComputedStyle(document.querySelector(sel)!).color;
        return {
          email: color(".m-account-email"),
          note: color(".m-account-note"),
          page: getComputedStyle(document.body).backgroundColor,
        };
      }, theme);
      expect(contrast(colors.email, colors.page), `${theme}: email`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.note, colors.page), `${theme}: offline note`).toBeGreaterThanOrEqual(4.5);
    }
  } finally {
    await page.evaluate(() => delete document.documentElement.dataset.theme);
  }
});
