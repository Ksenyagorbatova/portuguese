import { test, expect } from "@playwright/experimental-ct-react";
import { FeedbackBox, NextButton } from "./Feedback";

test.describe("NextButton", () => {
  test("labels the next step", async ({ mount }) => {
    const component = await mount(<NextButton isLast={false} onClick={() => {}} />);
    await expect(component).toHaveText("Дальше →");
  });

  test("labels the final step", async ({ mount }) => {
    const component = await mount(<NextButton isLast={true} onClick={() => {}} />);
    await expect(component).toHaveText("Завершить →");
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

test("FeedbackBox renders its kind class and children", async ({ mount }) => {
  const component = await mount(<FeedbackBox kind="success">Верно!</FeedbackBox>);
  await expect(component).toHaveClass(/fb success/);
  await expect(component).toContainText("Верно!");
});
