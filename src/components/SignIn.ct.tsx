import { test, expect } from "@playwright/experimental-ct-react";
import { SignIn } from "./SignIn";

// Registration is disabled (see SIGNUP_ENABLED in SignIn.tsx / convex/auth.ts).
// These tests lock in the UI half of that: only sign-in is reachable.
test.describe("SignIn with registration disabled", () => {
  test("renders the sign-in form", async ({ mount }) => {
    const component = await mount(<SignIn />);
    await expect(component.getByText("Вход", { exact: true })).toBeVisible();
    await expect(component.getByPlaceholder("Email")).toBeVisible();
    await expect(component.getByPlaceholder("Пароль")).toBeVisible();
    await expect(component.getByRole("button", { name: "Войти" })).toBeVisible();
  });

  test("does not expose the registration switch", async ({ mount }) => {
    const component = await mount(<SignIn />);
    await expect(component.getByText("Зарегистрироваться")).toHaveCount(0);
    await expect(component.getByText("Нет аккаунта?")).toHaveCount(0);
  });
});
