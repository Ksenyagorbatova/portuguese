import { test, expect } from "@playwright/experimental-ct-react";
import { ResultFeedback, RetryBox, NextButton } from "./Feedback";

test.describe("NextButton", () => {
  test("labels the next step", async ({ mount }) => {
    const component = await mount(<NextButton isLast={false} onClick={() => {}} />);
    await expect(component).toContainText("Дальше");
  });

  test("labels the final step", async ({ mount }) => {
    const component = await mount(<NextButton isLast={true} onClick={() => {}} />);
    await expect(component).toContainText("Завершить");
  });

  test("fires onClick", async ({ mount }) => {
    let clicked = false;
    const component = await mount(
      <NextButton
        isLast={false}
        onClick={() => {
          clicked = true;
        }}
      />,
    );
    await component.click();
    expect(clicked).toBe(true);
  });
});

test("ResultFeedback renders its state class and children", async ({ mount }) => {
  const component = await mount(<ResultFeedback ok={true}>Верно!</ResultFeedback>);
  await expect(component).toHaveClass(/m-fb success/);
  await expect(component).toContainText("Верно!");
});

// ── A11y ─────────────────────────────────────────────────────────────────────

test("ResultFeedback is a polite live region", async ({ mount }) => {
  const component = await mount(<ResultFeedback ok={false}>Правильно: olá</ResultFeedback>);
  await expect(component).toHaveAttribute("aria-live", "polite");
  await expect(component).toHaveRole("status");
});

test("RetryBox is a polite live region", async ({ mount }) => {
  const component = await mount(<RetryBox>Не совсем!</RetryBox>);
  await expect(component).toHaveAttribute("aria-live", "polite");
  await expect(component).toHaveRole("status");
});

test("NextButton is autofocused so Enter advances", async ({ mount }) => {
  let clicked = 0;
  const component = await mount(
    <NextButton
      isLast={false}
      onClick={() => {
        clicked += 1;
      }}
    />,
  );
  await expect(component).toBeFocused();
  await component.press("Enter");
  expect(clicked).toBe(1);
});

test("held Enter (autorepeat) clicks «Дальше» only once", async ({ mount, page }) => {
  let clicked = 0;
  const component = await mount(
    <NextButton
      isLast={false}
      onClick={() => {
        clicked += 1;
      }}
    />,
  );
  await expect(component).toBeFocused();
  await page.keyboard.down("Enter"); // настоящее нажатие — клик
  await page.keyboard.down("Enter"); // не отпуская: autorepeat (e.repeat) — игнор
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  expect(clicked).toBe(1);
});
