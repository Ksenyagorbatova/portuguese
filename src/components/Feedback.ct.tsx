import { test, expect } from "@playwright/experimental-ct-react";
import { ResultFeedback, NextButton } from "./Feedback";

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
