import { test, expect } from "@playwright/experimental-ct-react";
import { SignIn } from "./SignIn";

// Registration is enabled (SIGNUP_ENABLED = true in SignIn.tsx / convex/auth.ts,
// owner's decision 2026-09-26 for the iOS/TestFlight rollout). These tests lock
// in the UI half: the switch is reachable and flips the form both ways.
test.describe("SignIn with registration enabled", () => {
  test("renders the sign-in form", async ({ mount }) => {
    const component = await mount(<SignIn />);
    await expect(component.getByText("С возвращением", { exact: true })).toBeVisible();
    await expect(component.getByPlaceholder("Email")).toBeVisible();
    await expect(component.getByPlaceholder("Пароль")).toBeVisible();
    await expect(component.getByRole("button", { name: "Войти" })).toBeVisible();
  });

  test("exposes the registration switch and flips the form to sign-up and back", async ({
    mount,
  }) => {
    const component = await mount(<SignIn />);
    await expect(component.getByText("Нет аккаунта?")).toBeVisible();

    await component.getByText("Нет аккаунта?").click();
    await expect(component.getByText("Регистрация", { exact: true })).toBeVisible();
    await expect(component.getByRole("button", { name: "Зарегистрироваться" })).toBeVisible();
    // Новый пароль — подсказка менеджеру паролей сгенерировать, а не подставить.
    await expect(component.getByPlaceholder("Пароль")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );

    await component.getByText("Уже есть аккаунт?").click();
    await expect(component.getByText("С возвращением", { exact: true })).toBeVisible();
    await expect(component.getByRole("button", { name: "Войти" })).toBeVisible();
    await expect(component.getByPlaceholder("Пароль")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  // Переключатель раньше был <div onClick> (мёртвый код при закрытой
  // регистрации) — с клавиатуры до регистрации было не добраться.
  test("the sign-up switch is a real button reachable from the keyboard", async ({ mount, page }) => {
    const component = await mount(<SignIn />);
    const toSignUp = component.getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" });
    await expect(toSignUp).toHaveAttribute("type", "button");
    await toSignUp.focus();
    await page.keyboard.press("Enter");
    await expect(component.getByText("Регистрация", { exact: true })).toBeVisible();
    // Кнопка переключателя не сабмитит форму (type=button).
    await expect(component.getByRole("button", { name: "Уже есть аккаунт? Войти" })).toBeVisible();
  });

  // Рубильник: SIGNUP_ENABLED=false (проп — для теста) прячет переключатель.
  test("the kill switch hides the sign-up switch", async ({ mount }) => {
    const component = await mount(<SignIn signupEnabled={false} />);
    await expect(component.getByText("Нет аккаунта?")).toHaveCount(0);
    await expect(component.getByRole("button", { name: "Войти", exact: true })).toBeVisible();
  });

  test("the fields carry accessible labels, not only placeholders", async ({ mount }) => {
    const component = await mount(<SignIn />);
    await expect(component.getByLabel("Email")).toBeVisible();
    await expect(component.getByLabel("Пароль")).toBeVisible();
  });

  // iOS: без этих атрибутов клавиатура капитализирует первую букву email и
  // «исправляет» его автокоррекцией — адрес не совпадает с аккаунтом.
  test("the email field opts out of auto-capitalization and autocorrect", async ({ mount }) => {
    const component = await mount(<SignIn />);
    const email = component.getByPlaceholder("Email");
    await expect(email).toHaveAttribute("inputmode", "email");
    await expect(email).toHaveAttribute("autocapitalize", "none");
    await expect(email).toHaveAttribute("autocorrect", "off");
    await expect(email).toHaveAttribute("spellcheck", "false");
  });

  // Коды ConvexError сервера → понятные сообщения (plain Error в проде
  // приходит как «Server Error» без деталей — для него общий текст).
  for (const [code, text] of [
    ["ACCOUNT_EXISTS", "Аккаунт с таким email уже есть — войдите."],
    ["REGISTRATION_DISABLED", "Регистрация сейчас закрыта."],
    ["INVALID_EMAIL", "Проверьте email — похоже, в нём опечатка."],
  ] as const) {
    test(`sign-up error ${code} shows a specific message`, async ({ mount, page }) => {
      const component = await mount(<SignIn />);
      await page.evaluate((c) => (window.__signInError = c), code);
      await component.getByText("Нет аккаунта?").click();
      await component.getByPlaceholder("Email").fill("taken@example.com");
      await component.getByPlaceholder("Пароль").fill("password123");
      await component.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
      await expect(component.getByText(text)).toBeVisible();
    });
  }

  test("an unknown sign-up failure shows the generic message, not «account exists»", async ({
    mount,
    page,
  }) => {
    const component = await mount(<SignIn />);
    await page.evaluate(() => (window.__signInError = true));
    await component.getByText("Нет аккаунта?").click();
    await component.getByPlaceholder("Email").fill("new@example.com");
    await component.getByPlaceholder("Пароль").fill("password123");
    await component.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
    await expect(
      component.getByText("Не удалось зарегистрироваться. Проверьте соединение и попробуйте ещё раз."),
    ).toBeVisible();
  });
});
