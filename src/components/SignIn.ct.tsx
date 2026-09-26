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
});
